"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Flame, Loader2, PenLine, RefreshCw, Shuffle, Users } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { Textarea, FieldLabel } from "@/components/ui/Input";
import {
  CATEGORY_DESCRIPTIONS,
  CATEGORY_LABELS,
  COMMUNITY_RULES,
  MAX_CONTENT_LENGTH,
  MIN_CONTENT_LENGTH,
  SUBMISSION_LIMITS,
  type SubmissionCategory,
} from "@/lib/constants";
import { searchEligibleRecipients, pickRandomRecipient } from "@/lib/supabase/profiles";
import { createSubmission, getDailyUsage } from "@/lib/supabase/submissions";
import type { PublicProfile } from "@/lib/supabase/profiles";
import { cn } from "@/lib/utils";

const CATEGORIES: SubmissionCategory[] = ["compliment", "roast", "joke", "observation"];

interface ComposerProps {
  userId: string | null;
}

/**
 * Submission composer — wired to Supabase (Stage 4).
 * Recipients come from the profiles table (public fields only, self and
 * blocked users excluded). Submissions are server-validated and always
 * land as status='pending'; the sender is derived from the session.
 */
export function SubmissionComposer({ userId }: ComposerProps) {
  const [category, setCategory] = useState<SubmissionCategory>("joke");
  const [content, setContent] = useState("");
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<PublicProfile[]>([]);
  const [query, setQuery] = useState("");
  const [listStatus, setListStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [usage, setUsage] = useState({ used: 0, limit: SUBMISSION_LIMITS.maxPerDay });
  const [reloadCount, setReloadCount] = useState(0);

  const remaining = MAX_CONTENT_LENGTH - content.length;
  const tooShort = content.trim().length < MIN_CONTENT_LENGTH;
  const limitReached = usage.used >= usage.limit;
  const canSubmit =
    Boolean(recipientId) && !tooShort && remaining >= 0 && !submitting && !limitReached;

  const selectedRecipient = recipients.find((r) => r.id === recipientId) ?? null;

  // Debounced recipient search. Data fetching lives in the timeout
  // callback so React state updates stay outside the effect body.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setListStatus("loading");
      const { recipients: rows, error: err } = await searchEligibleRecipients(userId, query);
      if (cancelled) return;
      if (err) {
        setListStatus("error");
        return;
      }
      setRecipients(rows);
      setListStatus("idle");
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userId, query, reloadCount]);

  function reloadRecipients() {
    setReloadCount((c) => c + 1);
  }

  useEffect(() => {
    getDailyUsage().then(setUsage);
  }, []);

  async function handleRandom() {
    if (!userId) return;
    const { recipient } = await pickRandomRecipient(userId);
    if (recipient) {
      setRecipientId(recipient.id);
      // Ensure the random pick is in the list so it renders as selected.
      setRecipients((prev) =>
        prev.some((r) => r.id === recipient.id) ? prev : [...prev, recipient],
      );
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !recipientId) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const result = await createSubmission({ recipientId, category, content });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setSuccess(result.message);
    setContent("");
    setRecipientId(null);
    setUsage((u) => ({ ...u, used: u.used + 1 }));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Recipient */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-ink">
              <Users className="h-5 w-5 text-accent" aria-hidden="true" />
              Who&apos;s the target?
            </h2>
            <Button type="button" variant="secondary" size="sm" onClick={handleRandom}>
              <Shuffle className="h-4 w-4" aria-hidden="true" />
              Random
            </Button>
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            Pick a classmate — they&apos;ll never know it was you.
          </p>
        </CardHeader>
        <CardBody>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or class…"
            aria-label="Search recipients"
            className="h-11 w-full rounded-xl border border-line bg-paper px-3.5 text-sm focus:border-ink/50 focus:outline-none focus:ring-2 focus:ring-accent/25"
          />
          <div className="mt-3">
            {listStatus === "loading" && (
              <p className="flex items-center gap-2 text-sm text-ink-faint">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading classmates…
              </p>
            )}
            {listStatus === "error" && (
              <p className="flex items-center gap-2 text-sm text-roast" role="alert">
                <button
                  type="button"
                  onClick={reloadRecipients}
                  className="inline-flex items-center gap-1 text-ink-soft underline"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
                </button>
                Could not load classmates.
              </p>
            )}
            {listStatus === "idle" && recipients.length === 0 && (
              <p className="text-sm text-ink-faint">
                No classmates match. Try a different name or class.
              </p>
            )}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {recipients.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRecipientId(r.id)}
                aria-pressed={recipientId === r.id}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left text-sm font-semibold transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-accent",
                  recipientId === r.id
                    ? "border-ink bg-ink text-paper"
                    : "border-line bg-paper-elevated text-ink hover:border-line-strong",
                )}
              >
                <span>
                  {r.displayName}
                  <span
                    className={cn(
                      "ml-2 text-xs font-medium",
                      recipientId === r.id ? "text-paper/70" : "text-ink-faint",
                    )}
                  >
                    {r.className}
                  </span>
                </span>
                {recipientId === r.id && <Check className="h-4 w-4" aria-hidden="true" />}
              </button>
            ))}
          </div>
          {selectedRecipient && (
            <p className="mt-3 text-sm font-semibold text-ink">
              Target locked: {selectedRecipient.displayName}{" "}
              <span className="font-medium text-ink-faint">({selectedRecipient.className})</span>
            </p>
          )}
        </CardBody>
      </Card>

      {/* Category */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-extrabold tracking-tight text-ink">Pick a flavour</h2>
          <p className="mt-1 text-sm text-ink-soft">Categories help the editors and the feed.</p>
        </CardHeader>
        <CardBody>
          <div
            className="grid grid-cols-2 gap-2 lg:grid-cols-4"
            role="radiogroup"
            aria-label="Submission category"
          >
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={category === c}
                onClick={() => setCategory(c)}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-accent",
                  category === c
                    ? "border-ink bg-paper shadow-[var(--shadow-card)]"
                    : "border-line bg-paper-elevated hover:border-line-strong",
                )}
              >
                <CategoryBadge category={c} />
                <span className="text-xs leading-snug text-ink-soft">
                  {CATEGORY_DESCRIPTIONS[c]}
                </span>
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Composer */}
      <Card>
        <CardHeader>
          <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-ink">
            <PenLine className="h-5 w-5 text-accent" aria-hidden="true" />
            Write it
          </h2>
        </CardHeader>
        <CardBody>
          <FieldLabel htmlFor="submission-text">
            Your {CATEGORY_LABELS[category].toLowerCase()}
          </FieldLabel>
          <Textarea
            id="submission-text"
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, MAX_CONTENT_LENGTH))}
            rows={5}
            placeholder="Make it land. Sharp, specific, original — the good stuff gets published."
            aria-describedby="char-count"
            disabled={limitReached}
          />
          <div className="mt-2 flex items-center justify-between text-xs">
            <span
              className={cn("font-semibold", remaining < 100 ? "text-roast" : "text-ink-faint")}
            >
              <span id="char-count">{remaining} characters left</span>
            </span>
            {tooShort && (
              <span className="text-ink-faint">{MIN_CONTENT_LENGTH}+ characters needed</span>
            )}
          </div>

          {limitReached && (
            <p
              className="mt-3 rounded-xl bg-joke-soft px-4 py-3 text-sm font-semibold text-joke"
              role="status"
            >
              Daily limit reached ({usage.limit}). Come back tomorrow for more bits.
            </p>
          )}
          {error && (
            <p
              className="mt-3 rounded-xl bg-roast-soft px-4 py-3 text-sm font-semibold text-roast"
              role="alert"
            >
              {error}
            </p>
          )}
          {success && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 rounded-xl bg-compliment-soft px-4 py-3 text-sm font-semibold text-compliment"
              role="status"
            >
              {success} It&apos;s in the queue pending review.
            </motion.p>
          )}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed text-ink-faint">
              Submitted as <span className="font-bold text-ink">Anonymous</span>. Pending review
              before publication.
            </p>
            <motion.span whileTap={{ scale: 0.97 }}>
              <Button type="submit" size="lg" disabled={!canSubmit}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Flame className="h-4 w-4" aria-hidden="true" />
                    Submit anonymously
                  </>
                )}
              </Button>
            </motion.span>
          </div>
          {!selectedRecipient && !limitReached && (
            <p className="mt-3 text-xs text-ink-faint">Choose a recipient to enable submission.</p>
          )}
        </CardBody>
      </Card>

      {/* Guidelines */}
      <Card className="bg-paper">
        <CardHeader>
          <h2 className="text-base font-extrabold tracking-tight text-ink">The short rules</h2>
        </CardHeader>
        <CardBody>
          <ul className="flex flex-col gap-3">
            {COMMUNITY_RULES.map((rule) => (
              <li key={rule.title} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-bold text-ink">{rule.title}</span>
                  <span className="block text-sm text-ink-soft">{rule.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {/* Daily usage meter */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between text-xs font-semibold text-ink-soft">
            <span>Today&apos;s usage</span>
            <span>
              {usage.used}/{usage.limit}
            </span>
          </div>
          <div
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-valuenow={usage.used}
            aria-valuemin={0}
            aria-valuemax={usage.limit}
            aria-label="Daily submissions used"
          >
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${Math.min((usage.used / usage.limit) * 100, 100)}%` }}
            />
          </div>
        </CardBody>
      </Card>
    </form>
  );
}
