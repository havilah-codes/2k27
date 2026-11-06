import { AiProviderError } from "./types.ts";
import type { EvaluationRequest, FinalEvaluation, LlmProvider } from "./types.ts";
import { finalizeEvaluation } from "./validate.ts";

/**
 * Evaluation worker — queue claim → evaluate → finalize, with retries.
 * (Stage 5.) The store is injected so the orchestration is pure and unit
 * testable; the Supabase implementation lives in
 * `src/lib/supabase/evaluation-store.ts`.
 *
 * Duplicate-processing safety: rows must be CLAIMED atomically by the store
 * (status pending → processing, guarded by compare-and-set) before any AI
 * call happens. The worker only ever finalizes rows it claimed.
 */

export interface ClaimedSubmission {
  id: string;
  content: string;
  category: string;
  recipientId: string;
  /** attempts INCLUDING this claim (1-based). */
  attempts: number;
  claimTimestamp: string;
  request: EvaluationRequest;
}

export interface EvaluationStore {
  /** Recover rows stuck in `processing` (worker died) back to `pending`. */
  resetStaleClaims(cutoffISO: string): Promise<number>;
  /** Atomically claim up to `limit` pending submissions, oldest first. */
  claimBatch(limit: number): Promise<ClaimedSubmission[]>;
  /** Atomically claim one specific pending submission by ID (or null). */
  claimById(id: string): Promise<ClaimedSubmission | null>;
  /** Guarded finalize: only lands if the claim is still ours. */
  submitResult(claimed: ClaimedSubmission, record: FinalEvaluation): Promise<boolean>;
  /** Return the row to `pending` for retry, or finalize it flagged (give up). */
  releaseForRetry(claimed: ClaimedSubmission, errorMessage: string, giveUp: boolean): Promise<void>;
}

export const MAX_ATTEMPTS = 3;
export const STALE_CLAIM_MINUTES = 10;

export interface ProcessSummary {
  claimed: number;
  approved: number;
  rejected: number;
  flagged: number;
  retried: number;
  failed: number;
  items: Array<{ id: string; outcome: "approved" | "rejected" | "flagged" | "retried" | "failed" }>;
}

async function evaluateOne(
  store: EvaluationStore,
  provider: LlmProvider,
  claimed: ClaimedSubmission,
): Promise<"approved" | "rejected" | "flagged" | "retried" | "failed"> {
  let raw;
  try {
    raw = await provider.evaluate(claimed.request);
  } catch (err) {
    const errCode = err instanceof AiProviderError ? err.code : "upstream";
    const message = err instanceof Error ? err.message : "unknown evaluation error";
    const giveUp = claimed.attempts >= MAX_ATTEMPTS || errCode === "config";
    // config (missing key, 4xx client errors) can never succeed — flag at once.
    await store.releaseForRetry(claimed, `[${errCode}] ${message}`, giveUp);
    return giveUp ? "failed" : "retried";
  }

  const record = finalizeEvaluation(raw);
  await store.submitResult(claimed, record);
  return record.moderation_status;
}

/** Evaluate a single already-claimed submission (used by the POST route). */
export async function processOne(
  store: EvaluationStore,
  provider: LlmProvider,
  claimed: ClaimedSubmission,
): Promise<"approved" | "rejected" | "flagged" | "retried" | "failed"> {
  return evaluateOne(store, provider, claimed);
}

/** Process one batch of pending submissions. Safe to run concurrently. */
export async function processBatch(params: {
  store: EvaluationStore;
  provider: LlmProvider;
  batchSize?: number;
  now?: Date;
}): Promise<ProcessSummary> {
  const { store, provider } = params;
  const batchSize = params.batchSize ?? 10;
  const now = params.now ?? new Date();

  await store.resetStaleClaims(
    new Date(now.getTime() - STALE_CLAIM_MINUTES * 60_000).toISOString(),
  );

  const claimed = await store.claimBatch(batchSize);
  const summary: ProcessSummary = {
    claimed: claimed.length,
    approved: 0,
    rejected: 0,
    flagged: 0,
    retried: 0,
    failed: 0,
    items: [],
  };

  for (const item of claimed) {
    const outcome = await evaluateOne(store, provider, item);
    summary.items.push({ id: item.id, outcome });
    summary[outcome === "failed" ? "failed" : outcome]++;
  }

  return summary;
}
