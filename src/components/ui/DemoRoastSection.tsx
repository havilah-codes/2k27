"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Flame, RotateCcw, Search } from "lucide-react";
import { Button } from "./Button";
import { FieldLabel, Input } from "./Input";
import { ReactionBar } from "./ReactionBar";
import { findRoasts, DEMO_ROASTS } from "@/lib/demo-roasts";

const STORAGE_KEY = "2k27-demo-roasts:consumed";

const VANISH_LINES = [
  "gone. just like your composure.",
  "roast spent. file under 'facts'.",
  "that one stung for real.",
  "archived in the hall of pain.",
  "evaporated. like your attendance.",
];

interface LiveCard {
  key: string;
  text: string;
}

/**
 * The class-roast easter egg (from the original joke script):
 * type a classmate's full name → their insults appear as cards →
 * each card vanishes the instant someone reacts to it. Consumed cards
 * stay consumed per device (localStorage). 100% client-only demo content;
 * nothing here ever touches the database or the real feed.
 */
export function DemoRoastSection() {
  const [name, setName] = useState("");
  const [set, setSet] = useState<{ name: string; insults: string[] } | null>(null);
  const [missing, setMissing] = useState<string | null>(null);
  const [consumed, setConsumed] = useState<Set<string>>(new Set());
  const [lastVanish, setLastVanish] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) setConsumed(new Set(JSON.parse(raw) as string[]));
      } catch {
        // storage unavailable — demo still works in-memory
      }
      setLoaded(true);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  function persist(next: Set<string>) {
    setConsumed(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      // best-effort
    }
  }

  function doLookup(query: string) {
    const found = findRoasts(query);
    setLastVanish(null);
    if (!found) {
      setMissing(query.trim() || "your friend");
      setSet(null);
      return;
    }
    setMissing(null);
    setSet(found);
  }

  function lookup(e: React.FormEvent) {
    e.preventDefault();
    doLookup(name);
  }

  function pickSuggestion(suggestion: string) {
    setName(suggestion);
    doLookup(suggestion);
  }

  // Suggestions under the input, live as you type.
  const queryText = name.trim().toLowerCase();
  const suggestions =
    queryText && !set && !missing
      ? DEMO_ROASTS.map((r) => r.name)
          .filter((n) => n.toLowerCase().includes(queryText))
          .slice(0, 5)
      : [];

  function vanish(key: string) {
    const next = new Set(consumed).add(key);
    persist(next);
    setLastVanish(VANISH_LINES[(next.size - 1) % VANISH_LINES.length]);
  }

  function reset() {
    persist(new Set());
    setSet(null);
    setMissing(null);
    setLastVanish(null);
    setName("");
  }

  const cards: LiveCard[] = set
    ? set.insults
        .map((text, i) => ({ key: `${set.name}::${i}`, text }))
        .filter((c) => !consumed.has(c.key))
    : [];

  return (
    <section
      aria-label="Class roasts — a little joke"
      className="rounded-2xl border border-dashed border-line-strong bg-paper-elevated p-5 sm:p-6"
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent-ink">
        A little joke
      </p>
      <h2 className="mt-1 text-lg font-extrabold tracking-tight text-ink">
        Someone in this class is really pissed at you.
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        Everything below was written by a classmate who wants to insult you. Type your full name —
        and react to a roast, and watch it disappear. (Demo content — not from the real feed.)
      </p>

      <form onSubmit={lookup} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <FieldLabel htmlFor="demo-roast-name">What is your full name?</FieldLabel>
          <Input
            id="demo-roast-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Big Sam"
            autoComplete="off"
            list="demo-roast-names"
          />
          <datalist id="demo-roast-names">
            {DEMO_ROASTS.map((r) => (
              <option key={r.name} value={r.name} />
            ))}
          </datalist>
          {suggestions.length > 0 && (
            <ul
              className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-line bg-paper-elevated shadow-[var(--shadow-pop)]"
              role="listbox"
              aria-label="Matching classmates"
            >
              {suggestions.map((s) => (
                <li key={s} role="option" aria-selected="false">
                  <button
                    type="button"
                    onClick={() => pickSuggestion(s)}
                    className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm font-semibold text-ink transition-colors hover:bg-paper focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {s}
                    <span className="text-xs font-medium text-ink-faint">tap to roast</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button type="submit" size="md">
          <Search className="h-4 w-4" aria-hidden="true" />
          Roast me
        </Button>
      </form>

      {missing && (
        <p className="mt-4 rounded-xl bg-paper px-4 py-3 text-sm font-semibold text-ink-soft">
          No insults found for {missing}. Lucky you — the class ran out of things to say.
        </p>
      )}

      {set && cards.length === 0 && loaded && (
        <div className="mt-4 flex flex-col gap-3">
          <p className="rounded-xl bg-compliment-soft px-4 py-3 text-sm font-semibold text-compliment">
            All roasts spent. The class forgives {set.name}… probably.
          </p>
          <Button type="button" variant="secondary" size="sm" onClick={reset}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Replay the joke
          </Button>
        </div>
      )}

      {lastVanish && cards.length > 0 && (
        <p className="mt-3 text-xs font-semibold text-ink-faint" aria-live="polite">
          {lastVanish}
        </p>
      )}

      <AnimatePresence mode="popLayout">
        <div className="mt-4 flex flex-col gap-3">
          {cards.map((card) => (
            <motion.article
              key={card.key}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -8, filter: "blur(2px)" }}
              transition={{ duration: 0.28 }}
              className="rounded-2xl border border-line bg-paper p-4"
              aria-label={`Demo roast for ${set?.name}`}
            >
              <blockquote className="border-l-[3px] border-accent/70 pl-4 text-[15px] leading-relaxed text-ink">
                {card.text}
              </blockquote>
              <footer className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-ink-faint">
                  for {set?.name} · demo data
                </span>
                <ReactionBar
                  counts={{ laugh: 0, love: 0, fire: 0 }}
                  myReaction={null}
                  compact
                  onReact={() => vanish(card.key)}
                />
              </footer>
            </motion.article>
          ))}
        </div>
      </AnimatePresence>

      <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-faint">
        <Flame className="h-3.5 w-3.5" aria-hidden="true" />
        React to a roast and it vanishes. Real posts are in the feed below.
      </p>
    </section>
  );
}
