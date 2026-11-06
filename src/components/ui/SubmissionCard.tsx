"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Clock3, EyeOff, Flag, MoreHorizontal } from "lucide-react";
import { Avatar } from "./Avatar";
import { CategoryBadge } from "./CategoryBadge";
import { ReactionBar } from "./ReactionBar";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Textarea, FieldLabel } from "./Input";
import type { FeedSubmission } from "@/lib/supabase/feed";

interface SubmissionCardProps {
  submission: FeedSubmission;
  index?: number;
}

/**
 * Public submission card. The submission author is never shown — it is
 * always rendered as "Anonymous". Reactions are visual-only local state
 * (persistence arrives with Stage 6); report is a visual form (Stage 7).
 */
export function SubmissionCard({ submission, index = 0 }: SubmissionCardProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState(false);

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.06, 0.4), duration: 0.35, ease: "easeOut" }}
      className="rounded-2xl border border-line bg-paper-elevated p-5 shadow-[var(--shadow-card)]"
      aria-label={`Submission about ${submission.recipient.displayName}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={submission.recipient.displayName} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-ink">
              {submission.recipient.displayName}
            </p>
            <p className="text-xs text-ink-faint">{submission.recipient.className}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CategoryBadge category={submission.category} />
          <button
            onClick={() => setReportOpen(true)}
            aria-label="Report this submission"
            className="rounded-full p-1.5 text-ink-faint transition-colors hover:bg-paper hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>
      </header>

      <blockquote className="mt-4 border-l-[3px] border-accent/70 pl-4 text-[16px] leading-relaxed text-ink sm:text-[17px]">
        {submission.content}
      </blockquote>

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs text-ink-faint">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            {submission.timeLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
            Anonymous
          </span>
        </div>
        <ReactionBar counts={submission.reactions} myReaction={submission.myReaction} />
      </footer>

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Report submission">
        {reported ? (
          <div className="py-2">
            <div className="rounded-xl bg-compliment-soft px-4 py-3 text-sm font-semibold text-compliment">
              Report noted. An admin will review it against the community rules.
            </div>
            <Button className="mt-4 w-full" onClick={() => setReportOpen(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setReported(true);
            }}
            className="flex flex-col gap-4"
          >
            <p className="text-sm leading-relaxed text-ink-soft">
              Reports are reviewed by a human admin. Rude or controversial isn&apos;t automatically
              removed — threats, slurs and targeted harassment are.
            </p>
            <div>
              <FieldLabel htmlFor={`report-reason-${submission.id}`}>Reason</FieldLabel>
              <select
                id={`report-reason-${submission.id}`}
                required
                className="h-11 w-full rounded-xl border border-line bg-paper-elevated px-3 text-sm focus:border-ink/50 focus:outline-none focus:ring-2 focus:ring-accent/25"
              >
                <option value="">Select a reason…</option>
                <option value="threat">Threat or intimidation</option>
                <option value="slur">Discriminatory insult</option>
                <option value="harassment">Repeated targeted harassment</option>
                <option value="private">Private information</option>
                <option value="other">Something else</option>
              </select>
            </div>
            <div>
              <FieldLabel htmlFor={`report-desc-${submission.id}`}>Details (optional)</FieldLabel>
              <Textarea id={`report-desc-${submission.id}`} rows={3} maxLength={1000} placeholder="Context helps an admin decide." />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setReportOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                <Flag className="h-4 w-4" aria-hidden="true" />
                Send report
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </motion.article>
  );
}
