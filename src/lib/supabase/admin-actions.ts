"use server";

import {
  getModerationQueue as fetchQueue,
  adminOverride as applyOverride,
  getPendingCount as fetchPendingCount,
  type ModerationQueueItem,
} from "./evaluation-store";

export type { ModerationQueueItem };

/**
 * Server actions wrapping the Stage 5 moderation data layer for the
 * Stage 7 admin dashboard. Admin gating lives in evaluation-store.ts.
 */
export async function getModerationQueueAction(limit = 50): Promise<ModerationQueueItem[]> {
  return fetchQueue(limit);
}

export async function adminOverrideAction(params: {
  submissionId: string;
  decision: "approved" | "rejected" | "flagged";
  reason: string;
}): Promise<{ ok: boolean; message: string }> {
  return applyOverride(params);
}

export async function getPendingCountAction(): Promise<number> {
  return fetchPendingCount();
}
