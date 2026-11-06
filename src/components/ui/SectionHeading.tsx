import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
  className?: string;
}

/** Editorial section heading: small eyebrow + strong title. */
export function SectionHeading({ title, eyebrow, action, className }: SectionHeadingProps) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div>
        {eyebrow && (
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent-ink">{eyebrow}</p>
        )}
        <h2 className="mt-1 text-xl font-extrabold tracking-tight text-ink sm:text-2xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}
