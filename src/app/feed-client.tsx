"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Archive, Flame, PenLine, Sparkles } from "lucide-react";
import { SubmissionCard } from "@/components/ui/SubmissionCard";
import { DemoRoastSection } from "@/components/ui/DemoRoastSection";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { CATEGORY_LABELS, type SubmissionCategory } from "@/lib/constants";
import type { FeedSubmission } from "@/lib/supabase/feed";
import { cn } from "@/lib/utils";

const FILTERS: ("all" | SubmissionCategory)[] = ["all", "compliment", "roast", "joke", "observation"];

/**
 * Client island for the homepage feed: category filter over the real
 * published submissions handed down from the server page.
 */
export function FeedClient({
  submissions,
  displayName,
}: {
  submissions: FeedSubmission[];
  displayName: string;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const filtered =
    filter === "all" ? submissions : submissions.filter((s) => s.category === filter);

  const totalReactions = submissions.reduce(
    (sum, s) => sum + Object.values(s.reactions).reduce((a, b) => a + b, 0),
    0,
  );

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-ink-soft">
          Hey <span className="font-bold text-ink">{displayName}</span> — welcome back.
        </p>
        <h1 className="text-3xl font-black leading-tight tracking-tight text-ink sm:text-4xl">
          Today&apos;s comedy.
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-ink-soft sm:text-base">
          Real posts from students, published daily. Every card is anonymous — the sender is never
          revealed.
        </p>
      </header>

      {/* Daily highlights */}
      <motion.section
        aria-label="Daily highlights"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative overflow-hidden rounded-2xl border border-line bg-ink p-6 text-paper sm:p-7"
      >
        <div
          className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/25 blur-2xl"
          aria-hidden="true"
        />
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-paper/70">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Daily highlights
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
          The best of today, hand-picked.
        </h2>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-paper/80">
          {submissions.length === 0
            ? "Nothing has been published yet today. New posts appear here once the daily collection drops."
            : `${submissions.length} submission${submissions.length === 1 ? "" : "s"} made today's cut. Top-rated by reactions from students like you.`}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4 text-xs font-semibold text-paper/70">
          <span className="inline-flex items-center gap-1.5">
            <Flame className="h-4 w-4" aria-hidden="true" />
            {totalReactions.toLocaleString()} reactions so far
          </span>
          <span>Next drop: tomorrow, 4:00 PM</span>
        </div>
      </motion.section>

      {/* The class-roast easter egg (demo content, vanishes on interaction) */}
      <DemoRoastSection />

      {/* Category filter */}
      <div>
        <SectionHeading title="Today's feed" eyebrow="The daily collection" />
        <div
          className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
          role="tablist"
          aria-label="Filter by category"
        >
          {FILTERS.map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                filter === f
                  ? "border-ink bg-ink text-paper"
                  : "border-line bg-paper-elevated text-ink-soft hover:border-line-strong hover:text-ink",
              )}
            >
              {f === "all" ? "All" : CATEGORY_LABELS[f]}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-4">
          {filtered.length === 0 ? (
            <EmptyState
              title={submissions.length === 0 ? "The feed is quiet for now" : "Nothing in this category today"}
              description={
                submissions.length === 0
                  ? "Real posts from students appear here after today's collection is published. Be the first to submit one."
                  : "No published posts in this category yet. Try another category or check the Hall of Fame."
              }
              icon={<Sparkles className="h-6 w-6" aria-hidden="true" />}
              action={
                <Link href={submissions.length === 0 ? "/submit" : "/hall-of-fame"}>
                  <Button variant="secondary">
                    <PenLine className="h-4 w-4" aria-hidden="true" />
                    {submissions.length === 0 ? "Submit a post" : "Browse the archive"}
                  </Button>
                </Link>
              }
            />
          ) : (
            filtered.map((submission, i) => (
              <SubmissionCard key={submission.id} submission={submission} index={i} />
            ))
          )}
        </div>

        <div className="mt-6 flex justify-center">
          <Link href="/hall-of-fame">
            <Button variant="secondary" size="lg">
              <Archive className="h-4 w-4" aria-hidden="true" />
              Browse the archive
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
