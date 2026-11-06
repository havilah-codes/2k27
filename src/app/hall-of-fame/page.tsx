import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getCollections, getTopSubmissions } from "@/lib/supabase/feed";
import { HallOfFameClient } from "./hall-of-fame-client";
import { FeedSkeleton } from "@/components/ui/Skeletons";

/**
 * Hall of Fame — real published daily collections only. Empty until
 * Stage 6 publishes the first collection.
 */
export default function HallOfFamePage() {
  return (
    <Suspense fallback={<FeedSkeleton count={3} />}>
      <FameData />
    </Suspense>
  );
}

async function FameData() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/hall-of-fame");

  const [collections, topSubmissions] = await Promise.all([
    getCollections(),
    getTopSubmissions(3),
  ]);

  return (
    <HallOfFameClient collections={collections} topSubmissions={topSubmissions} />
  );
}
