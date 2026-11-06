import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser, getCurrentProfile } from "@/lib/supabase/auth";
import { getDailyUsage } from "@/lib/supabase/submissions";
import { ProfileEditor } from "./profile-editor";

/**
 * Profile — real data from `profiles`. No demo identity, no sender history.
 */
export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex flex-col gap-4"
          aria-busy="true"
          aria-label="Loading profile"
        >
          <div className="h-8 w-40 animate-pulse rounded-md bg-line/80" />
          <div className="h-48 animate-pulse rounded-2xl bg-line/50" />
        </div>
      }
    >
      <ProfileData />
    </Suspense>
  );
}

async function ProfileData() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/profile");

  const [profile, usage] = await Promise.all([getCurrentProfile(), getDailyUsage()]);
  if (!profile) redirect("/signup");

  return <ProfileEditor profile={profile} usage={usage} />;
}
