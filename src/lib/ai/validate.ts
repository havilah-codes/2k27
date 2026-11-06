import { AiProviderError } from "./types.ts";
import type { FinalEvaluation, ModerationCategory, ModerationOutcome, RawEvaluation } from "./types.ts";
import { calculateOverallScore } from "./scoring.ts";

/**
 * Strict validation + application-side rule adjustment of AI output.
 * Arbitrary model output is never trusted: malformed JSON, out-of-range
 * scores and unknown statuses all raise AiProviderError("malformed").
 *
 * Rules applied here (deterministic, independent of the model):
 *  - Scores are only stored for APPROVED submissions (others store null).
 *  - "approved" with confidence < 0.65 is downgraded to "flagged" — uncertain
 *    approvals never become automatic approvals.
 *  - The weighted overall score is computed by calculateOverallScore().
 */

const STATUSES: readonly ModerationOutcome[] = ["approved", "rejected", "flagged"];
const CATEGORIES: readonly ModerationCategory[] = [
  "none",
  "threat",
  "discrimination",
  "harassment",
  "private_info",
];

export const LOW_CONFIDENCE_THRESHOLD = 0.65;
const MAX_REASON_LENGTH = 500;
const MAX_EVAL_LENGTH = 300;

function malformed(detail: string): AiProviderError {
  return new AiProviderError("malformed", `Malformed AI evaluation: ${detail}`);
}

function parseScore(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw malformed(`${field} must be a number between 0 and 100`);
  }
  if (value < 0 || value > 100) {
    throw malformed(`${field} must be between 0 and 100 (got ${value})`);
  }
  return Math.round(value * 100) / 100;
}

function parseShortString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw malformed(`${field} must be a non-empty string`);
  }
  return value.trim().slice(0, maxLength);
}

/** Validate the model's JSON object into a checked RawEvaluation. */
export function validateAiResponse(input: unknown): RawEvaluation {
  if (typeof input !== "object" || input === null) {
    throw malformed("response must be a JSON object");
  }
  const r = input as Record<string, unknown>;

  if (typeof r.moderation_status !== "string" || !(STATUSES as string[]).includes(r.moderation_status)) {
    throw malformed("moderation_status must be approved | rejected | flagged");
  }
  if (typeof r.moderation_category !== "string" || !(CATEGORIES as string[]).includes(r.moderation_category)) {
    throw malformed("moderation_category is invalid");
  }
  if (typeof r.confidence !== "number" || !Number.isFinite(r.confidence) || r.confidence < 0 || r.confidence > 1) {
    throw malformed("confidence must be a number between 0 and 1");
  }

  const raw: RawEvaluation = {
    moderation_status: r.moderation_status as ModerationOutcome,
    moderation_category: r.moderation_category as ModerationCategory,
    moderation_reason: parseShortString(r.moderation_reason, "moderation_reason", MAX_REASON_LENGTH),
    humour_score: parseScore(r.humour_score, "humour_score"),
    originality_score: parseScore(r.originality_score, "originality_score"),
    creativity_score: parseScore(r.creativity_score, "creativity_score"),
    relatability_score: parseScore(r.relatability_score, "relatability_score"),
    confidence: Math.round(r.confidence * 10000) / 10000,
    short_evaluation: parseShortString(r.short_evaluation, "short_evaluation", MAX_EVAL_LENGTH),
  };

  if (raw.moderation_status === "approved") {
    const missing = ["humour_score", "originality_score", "creativity_score", "relatability_score"].filter(
      (f) => raw[f as keyof RawEvaluation] === null,
    );
    if (missing.length > 0) {
      throw malformed(`approved submissions require all four scores (missing: ${missing.join(", ")})`);
    }
  }

  return raw;
}

/** Apply deterministic rules and compute the final stored record. */
export function finalizeEvaluation(raw: RawEvaluation): FinalEvaluation {
  let status = raw.moderation_status;
  let reason = raw.moderation_reason;
  let downgraded = false;

  if (status === "approved" && raw.confidence < LOW_CONFIDENCE_THRESHOLD) {
    status = "flagged";
    reason = `${reason} (Flagged for review: low confidence ${raw.confidence.toFixed(2)}.)`;
    downgraded = true;
  }

  const keepScores = status === "approved";
  const scores = keepScores
    ? {
        humour_score: raw.humour_score,
        originality_score: raw.originality_score,
        creativity_score: raw.creativity_score,
        relatability_score: raw.relatability_score,
      }
    : {
        humour_score: null,
        originality_score: null,
        creativity_score: null,
        relatability_score: null,
      };

  const overall_score =
    keepScores &&
    scores.humour_score !== null &&
    scores.originality_score !== null &&
    scores.creativity_score !== null &&
    scores.relatability_score !== null
      ? calculateOverallScore({
          humour: scores.humour_score,
          originality: scores.originality_score,
          creativity: scores.creativity_score,
          relatability: scores.relatability_score,
        })
      : null;

  return {
    moderation_status: status,
    moderation_category: raw.moderation_category,
    moderation_reason: reason,
    ...scores,
    overall_score,
    confidence: raw.confidence,
    short_evaluation: raw.short_evaluation,
    downgraded,
  };
}
