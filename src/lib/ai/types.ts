/**
 * Shared types for the AI evaluation engine (Stage 5).
 * Server-only module. No sender identity ever flows through these types —
 * the AI prompt receives content + public recipient info + history counts.
 */

export type ModerationOutcome = "approved" | "rejected" | "flagged";

export type ModerationCategory =
  | "none"
  | "threat"
  | "discrimination"
  | "harassment"
  | "private_info";

export type ProviderErrorCode = "timeout" | "malformed" | "upstream" | "auth" | "config";

export interface EvaluationRequest {
  category: string;
  content: string;
  recipientDisplayName: string;
  recipientClassName: string;
  /** Context for the harassment judgement. Counts only — never identities. */
  history: {
    submissionsTodayToRecipient: number;
    flaggedSubmissionsToRecipient: number;
  };
}

/** Shape the provider is asked to return (structured JSON). */
export interface RawEvaluation {
  moderation_status: ModerationOutcome;
  moderation_category: ModerationCategory;
  moderation_reason: string;
  humour_score: number | null;
  originality_score: number | null;
  creativity_score: number | null;
  relatability_score: number | null;
  confidence: number;
  short_evaluation: string;
}

/** Validated + rule-adjusted result, ready to store. */
export interface FinalEvaluation {
  moderation_status: ModerationOutcome;
  moderation_category: ModerationCategory;
  moderation_reason: string;
  humour_score: number | null;
  originality_score: number | null;
  creativity_score: number | null;
  relatability_score: number | null;
  overall_score: number | null;
  confidence: number;
  short_evaluation: string;
  /** True when application-side rules overrode/downgraded the AI verdict. */
  downgraded: boolean;
}

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  evaluate(request: EvaluationRequest): Promise<RawEvaluation>;
}

export class AiProviderError extends Error {
  readonly code: ProviderErrorCode;

  constructor(code: ProviderErrorCode, message: string) {
    super(message);
    this.name = "AiProviderError";
    this.code = code;
  }
}
