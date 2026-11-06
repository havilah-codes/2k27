import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser, getCurrentProfile } from "@/lib/supabase/auth";
import { getPublishedFeed } from "@/lib/supabase/feed";
import { FeedClient } from "./feed-client";
import { FeedSkeleton } from "@/components/ui/Skeletons";

/**
 * Homepage — The Daily Feed (real data).
 * Shows only `published` submissions written by real users. New submissions
 * enter as `pending` and become visible here only after AI evaluation and
 * daily publication (Stages 5–6). Sender identity is never fetched.
 */
export default function HomePage() {
  return (
    <Suspense fallback={<FeedSkeleton count={3} />}>
      <HomeData />
    </Suspense>
  );
}

async function HomeData() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/");

  const [profile, submissions] = await Promise.all([
    getCurrentProfile(),
    getPublishedFeed(50),
  ]);

  return (
    <FeedClient
      submissions={submissions}
      displayName={profile?.displayName ?? "there"}
    />
  );
}
