"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarDays, Crown, PenLine, Trophy } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { SubmissionCard } from "@/components/ui/SubmissionCard";
import type { FeedCollection, FeedSubmission } from "@/lib/supabase/feed";
import { cn } from "@/lib/utils";

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * Client island for the Hall of Fame: collection picker + archive feed over
 * real daily collections handed down from the server page.
 */
export function HallOfFameClient({
  collections,
  topSubmissions,
}: {
  collections: FeedCollection[];
  topSubmissions: FeedSubmission[];
}) {
  const [activeCollection, setActiveCollection] = useState<string | null>(
    collections[0]?.id ?? null,
  );

  const active = collections.find((c) => c.id === activeCollection) ?? collections[0];
  const featured = topSubmissions[0];

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-sm font-medium text-ink-soft">Yesterday&apos;s classics, forever.</p>
        <h1 className="mt-1 flex items-center gap-2.5 text-3xl font-black tracking-tight text-ink sm:text-4xl">
          <Trophy className="h-8 w-8 text-accent" aria-hidden="true" />
          Hall of Fame
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft sm:text-base">
          Every daily collection, archived. Weekly standouts get a crown — no public roast
          scoreboard, ever.
        </p>
      </header>

      {/* Featured */}
      {featured && (
        <motion.section
          aria-label="Featured submission"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-2xl border border-line bg-gradient-to-br from-accent-soft to-joke-soft p-6"
        >
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-accent-ink">
            <Crown className="h-3.5 w-3.5" aria-hidden="true" />
            Most-loved post
          </p>
          <blockquote className="mt-3 max-w-2xl text-xl font-bold leading-snug tracking-tight text-ink sm:text-2xl">
            “{featured.content}”
          </blockquote>
          <p className="mt-3 text-sm font-semibold text-ink-soft">
            About {featured.recipient.displayName} · {featured.recipient.className} ·{" "}
            {Object.values(featured.reactions).reduce((a, b) => a + b, 0).toLocaleString()}{" "}
            reactions
          </p>
          <div className="mt-4">
            <CategoryBadge category={featured.category} />
          </div>
        </motion.section>
      )}

      {/* Collection picker */}
      <section aria-label="Past collections">
        <SectionHeading title="Past collections" eyebrow="The archive" />
        {collections.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No collections yet"
              description="Archived daily collections will appear here once the first week is published. Meanwhile, your posts are waiting to make history."
              icon={<Trophy className="h-6 w-6" aria-hidden="true" />}
              action={
                <Link href="/submit">
                  <Button variant="secondary">
                    <PenLine className="h-4 w-4" aria-hidden="true" />
                    Submit a post
                  </Button>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {collections.map((col) => (
              <button
                key={col.id}
                onClick={() => setActiveCollection(col.id)}
                aria-pressed={active?.id === col.id}
                className={cn(
                  "shrink-0 rounded-2xl border p-3.5 text-left transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-accent",
                  active?.id === col.id
                    ? "border-ink bg-ink text-paper"
                    : "border-line bg-paper-elevated text-ink hover:border-line-strong",
                )}
              >
                <span className="flex items-center gap-1.5 text-xs font-bold">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  {formatDate(col.collectionDate)}
                </span>
                <span
                  className={cn(
                    "mt-1 block text-xs",
                    active?.id === col.id ? "text-paper/70" : "text-ink-faint",
                  )}
                >
                  {col.itemCount} published
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Archive feed for the selected collection */}
      {active && active.submissions.length > 0 && (
        <section aria-label="Archive">
          <SectionHeading
            title={`From ${formatDate(active.collectionDate)}`}
            eyebrow="Selected collection"
          />
          <div className="mt-4 flex flex-col gap-4">
            {active.submissions.map((s, i) => (
              <SubmissionCard key={s.id} submission={s} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
