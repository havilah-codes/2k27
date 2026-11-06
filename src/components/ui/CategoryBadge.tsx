import { CATEGORY_LABELS, type SubmissionCategory } from "@/lib/constants";
import { cn } from "@/lib/utils";

const styles: Record<SubmissionCategory, string> = {
  compliment: "bg-compliment-soft text-compliment",
  roast: "bg-roast-soft text-roast",
  joke: "bg-joke-soft text-joke",
  observation: "bg-observation-soft text-observation",
};

interface CategoryBadgeProps {
  category: SubmissionCategory;
  className?: string;
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
        styles[category],
        className,
      )}
    >
      {CATEGORY_LABELS[category]}
    </span>
  );
}
