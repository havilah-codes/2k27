import {
  CATEGORY_LABELS,
  MAX_CONTENT_LENGTH,
  MIN_CONTENT_LENGTH,
  type SubmissionCategory,
} from "@/lib/constants";

export const VALID_CATEGORIES = Object.keys(CATEGORY_LABELS) as SubmissionCategory[];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface RawSubmissionInput {
  recipientId?: unknown;
  category?: unknown;
  content?: unknown;
  /** Client MAY send these, but the server must ignore them. */
  senderId?: unknown;
  status?: unknown;
}

export interface SubmissionValidation {
  ok: boolean;
  message: string;
  recipientId?: string;
  category?: SubmissionCategory;
  content?: string;
}

/**
 * Strict server-side validation for submission input.
 * Sender identity and status are ALWAYS derived server-side — any
 * client-provided senderId/status values are ignored (never trusted).
 */
function validateSubmissionInput(input: RawSubmissionInput): SubmissionValidation {
  const { recipientId, category, content } = input;

  if (typeof recipientId !== "string" || !UUID_RE.test(recipientId)) {
    return { ok: false, message: "Please choose a valid recipient." };
  }

  if (typeof category !== "string" || !(VALID_CATEGORIES as string[]).includes(category)) {
    return { ok: false, message: "Please choose a valid category." };
  }

  if (typeof content !== "string") {
    return { ok: false, message: "Your submission can't be empty." };
  }

  const trimmed = content.trim();
  if (trimmed.length < MIN_CONTENT_LENGTH) {
    return { ok: false, message: `Your submission needs at least ${MIN_CONTENT_LENGTH} characters.` };
  }
  if (trimmed.length > MAX_CONTENT_LENGTH) {
    return {
      ok: false,
      message: `Keep it under ${MAX_CONTENT_LENGTH} characters.`,
    };
  }

  return {
    ok: true,
    message: "Valid.",
    recipientId,
    category: category as SubmissionCategory,
    content: trimmed,
  };
}

export { validateSubmissionInput };
