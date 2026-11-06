"use server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "./server";
import { requireUser } from "./auth";
import { recipientExists, hasBlockRelationship } from "./profiles";
import { validateSubmissionInput, type RawSubmissionInput } from "@/lib/validation/submission";
import { SUBMISSION_LIMITS, type SubmissionCategory } from "@/lib/constants";

export type SubmissionActionResult =
  | { ok: true; submissionId: string; message: string }
  | { ok: false; message: string };

function startOfTodayUtc(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

/**
 * Totally public view of a submission. Deliberately contains NO sender
 * information — anonymity is enforced by never selecting/returning it.
 */
export interface PublicSubmission {
  id: string;
  recipient: { id: string; displayName: string; className: string };
  category: SubmissionCategory;
  content: string;
  publishedAt: string | null;
  createdAt: string;
}

/**
 * Create a submission.
 *
 * Security rules:
 * - Sender identity is derived from the authenticated session only.
 * - Status is always 'pending'. Client-provided status/senderId are ignored.
 * - No sender identity is returned in the response.
 * - Validation happens server-side (see validation/submission.ts).
 * - Submission limits are enforced server-side via submission_authors.
 */
export async function createSubmission(input: RawSubmissionInput): Promise<SubmissionActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, message: "You must be signed in to submit." };
  }

  const validation = validateSubmissionInput(input);
  if (!validation.ok || !validation.recipientId || !validation.category || !validation.content) {
    return { ok: false, message: validation.message };
  }

  const { recipientId, category, content } = validation;

  // Cannot submit to self.
  if (recipientId === user.id) {
    return { ok: false, message: "You can't submit to yourself." };
  }

  // Recipient must exist.
  if (!(await recipientExists(recipientId))) {
    return { ok: false, message: "That recipient doesn't exist." };
  }

  // Respect blocks in either direction.
  if (await hasBlockRelationship(user.id, recipientId)) {
    return { ok: false, message: "You can't submit to this person." };
  }

  // Limit checks need to join submission_authors with submissions. The
  // sender cannot SELECT their own pending submissions under RLS (only
  // recipient/admin/published can), so these reads run through the
  // service-role client. This is safe: senderId is still derived from the
  // session, and no sender data is returned to the client.
  const limitClient = createSupabaseAdminClient();
  const today = startOfTodayUtc();

  // Daily limit: count today's submissions from this sender.
  const { count: todayCount } = await limitClient
    .from("submission_authors")
    .select("submission_id", { count: "exact", head: true })
    .eq("sender_id", user.id)
    .gte("created_at", today);

  if ((todayCount ?? 0) >= SUBMISSION_LIMITS.maxPerDay) {
    return {
      ok: false,
      message: `Daily limit reached (${SUBMISSION_LIMITS.maxPerDay} submissions per day). Come back tomorrow.`,
    };
  }

  // Per-recipient limit + duplicate-content check.
  const { data: recentWithRecipient } = await limitClient
    .from("submission_authors")
    .select(
      "submission_id, submissions!inner(recipient_id, content, category, created_at)",
    )
    .eq("sender_id", user.id)
    .gte("created_at", today);

  type RecentRow = {
    submission_id: string;
    submissions:
      | {
          recipient_id: string;
          content: string;
          category: string;
          created_at: string;
        }
      | {
          recipient_id: string;
          content: string;
          category: string;
          created_at: string;
        }[];
  };

  const rows = (recentWithRecipient ?? []) as unknown as RecentRow[];
  const toSameRecipient = rows.filter((r) => {
    const sub = Array.isArray(r.submissions) ? r.submissions[0] : r.submissions;
    return sub?.recipient_id === recipientId;
  });

  if (toSameRecipient.length >= SUBMISSION_LIMITS.maxPerRecipientPerDay) {
    return {
      ok: false,
      message: `You've already submitted ${SUBMISSION_LIMITS.maxPerRecipientPerDay} times to this person today.`,
    };
  }

  const normalized = content.trim().toLowerCase();
  const duplicate = toSameRecipient.some((r) => {
    const sub = Array.isArray(r.submissions) ? r.submissions[0] : r.submissions;
    return sub?.content.trim().toLowerCase() === normalized;
  });
  if (duplicate) {
    return { ok: false, message: "You've already sent this exact submission today." };
  }

  // Inserts run through the session client so RLS still applies.
  const supabase = await createSupabaseServerClient();

  // Insert submission first (status forced to pending server-side).
  const { data: submission, error: insertError } = await supabase
    .from("submissions")
    .insert({
      recipient_id: recipientId,
      content,
      category,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !submission) {
    return { ok: false, message: "Something went wrong saving your submission. Please try again." };
  }

  // Map private sender identity. This table's RLS only allows the sender
  // and admins to read it — ordinary students can never see it.
  const { error: authorError } = await supabase
    .from("submission_authors")
    .insert({
      submission_id: submission.id,
      sender_id: user.id,
    });

  if (authorError) {
    // Roll back the orphan submission so we never have unsigned rows.
    await supabase.from("submissions").delete().eq("id", submission.id);
    return { ok: false, message: "Something went wrong saving your submission. Please try again." };
  }

  return {
    ok: true,
    submissionId: submission.id,
    message: "Queued for today's drop — pending review.",
  };
}

/** Today's submission usage for the current user (sender-private data). */
export async function getDailyUsage() {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { used: 0, limit: SUBMISSION_LIMITS.maxPerDay };
  }
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("submission_authors")
    .select("submission_id", { count: "exact", head: true })
    .eq("sender_id", user.id)
    .gte("created_at", startOfTodayUtc());
  return { used: count ?? 0, limit: SUBMISSION_LIMITS.maxPerDay };
}
