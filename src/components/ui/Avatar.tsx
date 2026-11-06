import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  anonymous?: boolean;
}

const sizeMap = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
};

/** Initial-based avatar. When anonymous, shows a masked identity. */
export function Avatar({ name, size = "md", className, anonymous = false }: AvatarProps) {
  const initials = anonymous
    ? "•"
    : name
        .split(" ")
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-tight",
        anonymous
          ? "bg-[repeating-linear-gradient(45deg,var(--color-accent-soft),var(--color-accent-soft)_6px,var(--color-joke-soft)_6px,var(--color-joke-soft)_12px)] text-ink"
          : "bg-ink text-paper",
        sizeMap[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}
