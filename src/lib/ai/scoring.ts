/**
 * Comedy scoring (Stage 5). The weighted overall score is computed HERE in
 * application code — the model never invents the final number.
 *
 *   humour       40%
 *   originality  25%
 *   creativity   20%
 *   relatability 15%
 *
 * Example: 90 / 80 / 85 / 75 → (90×.40)+(80×.25)+(85×.20)+(75×.15) = 83.25
 */

export const SCORE_WEIGHTS = {
  humour: 0.4,
  originality: 0.25,
  creativity: 0.2,
  relatability: 0.15,
} as const;

export interface ScoreSet {
  humour: number;
  originality: number;
  creativity: number;
  relatability: number;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** Weighted overall score, rounded to 2 decimals for stable storage. */
export function calculateOverallScore(scores: ScoreSet): number {
  const raw =
    clampScore(scores.humour) * SCORE_WEIGHTS.humour +
    clampScore(scores.originality) * SCORE_WEIGHTS.originality +
    clampScore(scores.creativity) * SCORE_WEIGHTS.creativity +
    clampScore(scores.relatability) * SCORE_WEIGHTS.relatability;
  return Math.round(raw * 100) / 100;
}
