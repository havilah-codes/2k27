import { cn } from "@/lib/utils";

function Block({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-line/80", className)} aria-hidden="true" />;
}

/** Skeleton for submission card lists. */
export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4" aria-label="Loading submissions" role="status">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-line bg-paper-elevated p-5">
          <div className="flex items-center gap-3">
            <Block className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Block className="h-4 w-32" />
              <Block className="h-3 w-20 mt-1.5" />
            </div>
            <Block className="h-5 w-16 rounded-full" />
          </div>
          <Block className="mt-4 h-4 w-full" />
          <Block className="mt-2 h-4 w-4/5" />
          <Block className="mt-2 h-4 w-2/3" />
          <div className="mt-4 flex gap-2">
            <Block className="h-8 w-20 rounded-full" />
            <Block className="h-8 w-20 rounded-full" />
            <Block className="h-8 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton for the daily highlights block. */
export function HighlightSkeleton() {
  return (
    <div
      className="rounded-2xl border border-line bg-paper-elevated p-5"
      aria-label="Loading highlights"
      role="status"
    >
      <Block className="h-3 w-24" />
      <Block className="mt-3 h-6 w-3/4" />
      <Block className="mt-2 h-6 w-1/2" />
      <Block className="mt-4 h-4 w-full" />
      <Block className="mt-2 h-4 w-5/6" />
    </div>
  );
}
