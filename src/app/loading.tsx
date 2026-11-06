import { FeedSkeleton, HighlightSkeleton } from "@/components/ui/Skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true">
      <div className="h-8 w-48 animate-pulse rounded-md bg-line/80" />
      <HighlightSkeleton />
      <FeedSkeleton count={3} />
    </div>
  );
}
