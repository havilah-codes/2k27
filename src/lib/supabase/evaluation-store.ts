import { createSupabaseAdminClient } from "./server";
import { isAdmin, requireUser } from "./auth";
import type { ClaimedSubmission, EvaluationStore } from "@/lib/ai/worker";
import type { FinalEvaluation } from "@/lib/ai/types";

/**
 * Supabase-backed EvaluationStore (Stage 5).
 * All reads/writes go through the SERVICE-ROLE client: evaluation operates
 * on pending submissions that RLS hides from everyone except recipient/admin,
 * so the cookie session client can't claim them. This file is server-only
 * by convention and never returns sender identity anywhere. Do NOT import
 * from client components — use src/lib/supabase/admin-actions.ts instead.
 */
interface PendingRow {
  id: string;
  content: string;
  category: string;
  recipient_id: string;
  evaluation_attempts: number;
}

async function buildClaimed(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  row: PendingRow,
  claimTimestamp: string,
): Promise<ClaimedSubmission> {
  const [{ data: recipient }, { count: todayCount }, { count: flaggedCount }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, class_name")
      .eq("id", row.recipient_id)
      .single(),
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", row.recipient_id)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", row.recipient_id)
      .eq("status", "flagged"),
  ]);

  return {
    id: row.id,
    content: row.content,
    category: row.category,
    recipientId: row.recipient_id,
    attempts: row.evaluation_attempts + 1,
    claimTimestamp,
    request: {
      category: row.category,
      content: row.content,
      recipientDisplayName: recipient?.display_name ?? "A student",
      recipientClassName: recipient?.class_name ?? "Unknown class",
      history: {
        submissionsTodayToRecipient: todayCount ?? 0,
        flaggedSubmissionsToRecipient: flaggedCount ?? 0,
      },
    },
  };
}

export const supabaseEvaluationStore: EvaluationStore = {
  async resetStaleClaims(cutoffISO: string): Promise<number> {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("submissions")
      .update({ status: "pending", claimed_at: null })
      .eq("status", "processing")
      .lt("claimed_at", cutoffISO)
      .select("id");
    return data?.length ?? 0;
  },

  async claimBatch(limit: number): Promise<ClaimedSubmission[]> {
    const supabase = createSupabaseAdminClient();
    const claimTimestamp = new Date().toISOString();
    const claimed: ClaimedSubmission[] = [];

    // Claim one at a time with a compare-and-set on status='pending', so two
    // concurrent workers can never claim the same row.
    while (claimed.length < limit) {
      const { data: next } = await supabase
        .from("submissions")
        .select("id, content, category, recipient_id, evaluation_attempts")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!next) break;

      const row = next as PendingRow;
      const { data: claimedRow } = await supabase
        .from("submissions")
        .update({
          status: "processing",
          claimed_at: claimTimestamp,
          evaluation_attempts: row.evaluation_attempts + 1,
        })
        .eq("id", row.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

      if (!claimedRow) continue; // lost the race — try the next pending row
      claimed.push(await buildClaimed(supabase, row, claimTimestamp));
    }

    return claimed;
  },

  async claimById(id: string): Promise<ClaimedSubmission | null> {
    const supabase = createSupabaseAdminClient();
    const claimTimestamp = new Date().toISOString();

    const { data: next } = await supabase
      .from("submissions")
      .select("id, content, category, recipient_id, evaluation_attempts")
      .eq("id", id)
      .eq("status", "pending")
      .maybeSingle();

    if (!next) return null;

    const row = next as PendingRow;
    const { data: claimedRow } = await supabase
      .from("submissions")
      .update({
        status: "processing",
        claimed_at: claimTimestamp,
        evaluation_attempts: row.evaluation_attempts + 1,
      })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (!claimedRow) return null;
    return buildClaimed(supabase, row, claimTimestamp);
  },

  async submitResult(claimed: ClaimedSubmission, record: FinalEvaluation): Promise<boolean> {
    const supabase = createSupabaseAdminClient();

    const { error: recordError } = await supabase.from("moderation_records").insert({
      submission_id: claimed.id,
      moderation_status: record.moderation_status,
      humour_score: record.humour_score,
      originality_score: record.originality_score,
      creativity_score: record.creativity_score,
      relatability_score: record.relatability_score,
      overall_score: record.overall_score,
      confidence: record.confidence,
      moderation_reason: record.moderation_reason,
      evaluation_meta: {
        category: record.moderation_category,
        short_evaluation: record.short_evaluation,
        downgraded: record.downgraded,
      },
    });

    if (recordError) return false;

    const { data: updated } = await supabase
      .from("submissions")
      .update({ status: record.moderation_status, claimed_at: null, last_evaluation_error: null })
      .eq("id", claimed.id)
      .eq("status", "processing")
      .eq("claimed_at", claimed.claimTimestamp)
      .select("id")
      .maybeSingle();

    if (!updated) {
      // Claim expired / was recovered by another worker — drop our orphan record.
      await supabase.from("moderation_records").delete().eq("submission_id", claimed.id);
      return false;
    }
    return true;
  },

  async releaseForRetry(
    claimed: ClaimedSubmission,
    errorMessage: string,
    giveUp: boolean,
  ): Promise<void> {
    const supabase = createSupabaseAdminClient();

    if (!giveUp) {
      await supabase
        .from("submissions")
        .update({ status: "pending", claimed_at: null, last_evaluation_error: errorMessage })
        .eq("id", claimed.id)
        .eq("status", "processing")
        .eq("claimed_at", claimed.claimTimestamp);
      return;
    }

    // Give up: flag for admin review with a full record.
    await supabase.from("moderation_records").insert({
      submission_id: claimed.id,
      moderation_status: "flagged",
      moderation_reason: `Automatic evaluation failed after ${claimed.attempts} attempt(s) (${errorMessage}). Needs manual review.`,
      evaluation_meta: { category: "none", short_evaluation: "", evaluation_failed: true },
    });
    await supabase
      .from("submissions")
      .update({ status: "flagged", claimed_at: null, last_evaluation_error: errorMessage })
      .eq("id", claimed.id)
      .eq("status", "processing")
      .eq("claimed_at", claimed.claimTimestamp);
  },
};

/**
 * Admin moderation queue (data layer for Stage 7).
 * Admin-gated server-side; returns submission + record detail WITHOUT sender.
 */
export interface ModerationQueueItem {
  submissionId: string;
  content: string;
  category: string;
  status: string;
  recipient: { displayName: string; className: string };
  record: {
    moderationStatus: string;
    moderationReason: string | null;
    humourScore: number | null;
    originalityScore: number | null;
    creativityScore: number | null;
    relatabilityScore: number | null;
    overallScore: number | null;
    confidence: number | null;
    evaluationMeta: Record<string, unknown>;
    createdAt: string;
  };
}

export async function getModerationQueue(limit = 50): Promise<ModerationQueueItem[]> {
  await requireUser();
  if (!(await isAdmin())) {
    throw new Error("FORBIDDEN");
  }

  const supabase = createSupabaseAdminClient();
  const { data: records } = await supabase
    .from("moderation_records")
    .select("id, submission_id, moderation_status, moderation_reason, humour_score, originality_score, creativity_score, relatability_score, overall_score, confidence, evaluation_meta, created_at")
    .in("moderation_status", ["flagged", "manual_review"])
    .order("created_at", { ascending: false })
    .limit(limit);

  const out: ModerationQueueItem[] = [];
  for (const record of records ?? []) {
    const { data: submission } = await supabase
      .from("submissions")
      .select("id, content, category, status, recipient_id")
      .eq("id", record.submission_id)
      .single();
    if (!submission) continue;

    const { data: recipient } = await supabase
      .from("profiles")
      .select("display_name, class_name")
      .eq("id", submission.recipient_id)
      .single();

    out.push({
      submissionId: submission.id,
      content: submission.content,
      category: submission.category,
      status: submission.status,
      recipient: {
        displayName: recipient?.display_name ?? "A student",
        className: recipient?.class_name ?? "Unknown class",
      },
      record: {
        moderationStatus: record.moderation_status,
        moderationReason: record.moderation_reason,
        humourScore: record.humour_score,
        originalityScore: record.originality_score,
        creativityScore: record.creativity_score,
        relatabilityScore: record.relatability_score,
        overallScore: record.overall_score,
        confidence: record.confidence,
        evaluationMeta: (record.evaluation_meta ?? {}) as Record<string, unknown>,
        createdAt: record.created_at,
      },
    });
  }
  return out;
}

/**
 * Admin override for a flagged submission (Stage 7 groundwork).
 * Only admins; records a manual_review outcome with the reviewer attached.
 */
export async function adminOverride(params: {
  submissionId: string;
  decision: "approved" | "rejected" | "flagged";
  reason: string;
}): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  if (!(await isAdmin())) {
    return { ok: false, message: "Admin access required." };
  }
  const reason = params.reason.trim();
  if (reason.length < 3 || reason.length > 500) {
    return { ok: false, message: "Reason must be between 3 and 500 characters." };
  }

  const supabase = createSupabaseAdminClient();

  const { error: recordError } = await supabase.from("moderation_records").insert({
    submission_id: params.submissionId,
    moderation_status: "manual_review",
    moderation_reason: `[Admin ${params.decision}] ${reason}`,
    reviewed_by: user.id,
  });
  if (recordError) {
    return { ok: false, message: "Couldn't save the review." };
  }

  const { error: updateError } = await supabase
    .from("submissions")
    .update({ status: params.decision })
    .eq("id", params.submissionId);
  if (updateError) {
    return { ok: false, message: "Saved the review but couldn't update the submission." };
  }
  return { ok: true, message: "Review saved." };
}

/** Pending queue depth (ops + future admin analytics). */
export async function getPendingCount(): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}
