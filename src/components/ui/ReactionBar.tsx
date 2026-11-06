"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Flame, Laugh, Lightbulb, MessageSquareHeart, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export const REACTION_TYPES = [
  { key: "laugh", label: "Laugh", Icon: Laugh },
  { key: "love", label: "Love", Icon: MessageSquareHeart },
  { key: "fire", label: "Fire", Icon: Flame },
  { key: "mind_blown", label: "Mind blown", Icon: Lightbulb },
  { key: "shocked", label: "Shocked", Icon: Sparkles },
] as const;

interface ReactionBarProps {
  counts: Record<string, number>;
  myReaction?: string | null;
  compact?: boolean;
  /** Optional hook, fired when a NEW reaction is selected (not deselected). */
  onReact?: (key: string) => void;
}

/**
 * Reaction pill group. Visual-only — reactions are local UI state
 * and intentionally do not persist to the database yet (Stage 6 wires them).
 */
export function ReactionBar({ counts, myReaction, compact = false, onReact }: ReactionBarProps) {
  const [selected, setSelected] = useState<string | null>(myReaction ?? null);
  const [localCounts, setLocalCounts] = useState(counts);

  function toggle(key: string) {
    const deselecting = selected === key;
    setLocalCounts((prev) => {
      const next = { ...prev };
      if (selected === key) {
        next[key] = Math.max(0, (next[key] ?? 0) - 1);
      } else {
        if (selected) next[selected] = Math.max(0, (next[selected] ?? 0) - 1);
        next[key] = (next[key] ?? 0) + 1;
      }
      return next;
    });
    setSelected((prev) => (prev === key ? null : key));
    if (!deselecting) onReact?.(key);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Reactions">
      {REACTION_TYPES.map(({ key, label, Icon }) => {
        const count = localCounts[key] ?? 0;
        const isActive = selected === key;
        return (
          <motion.button
            key={key}
            whileTap={{ scale: 0.9 }}
            onClick={() => toggle(key)}
            aria-pressed={isActive}
            aria-label={`${label} (${count})`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              isActive
                ? "border-ink bg-ink text-paper"
                : "border-line bg-paper text-ink-soft hover:border-line-strong hover:text-ink",
            )}
          >
            <Icon className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} strokeWidth={2.2} />
            <span className="tabular-nums">{count}</span>
            {!compact && <span className="hidden sm:inline">{label}</span>}
          </motion.button>
        );
      })}
    </div>
  );
}
