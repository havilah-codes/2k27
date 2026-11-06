import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

/** Designed empty state for feeds, archives and lists. */
export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-paper-elevated px-6 py-14 text-center",
        className,
      )}
    >
      {icon && (
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
          {icon}
        </span>
      )}
      <h3 className="text-base font-bold tracking-tight text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-soft">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
