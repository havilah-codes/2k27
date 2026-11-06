import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-xl border border-line bg-paper-elevated px-3.5 text-sm text-ink",
          "placeholder:text-ink-faint transition-colors",
          "focus:border-ink/50 focus:outline-none focus:ring-2 focus:ring-accent/25",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        {...props}
      />
    );
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded-xl border border-line bg-paper-elevated px-3.5 py-3 text-[15px] leading-relaxed text-ink",
          "placeholder:text-ink-faint transition-colors",
          "focus:border-ink/50 focus:outline-none focus:ring-2 focus:ring-accent/25",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        {...props}
      />
    );
  },
);

export function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-soft">
      {children}
    </label>
  );
}
