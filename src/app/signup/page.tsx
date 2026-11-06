import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser, getCurrentProfile } from "@/lib/supabase/auth";
import { SignupForm } from "./signup-form";
import { ProfileCompletion } from "./profile-completion";

/**
 * Signup page. Three cases:
 * - Already signed in + profile exists → home.
 * - Already signed in, no profile (first-time Google login) → profile
 *   completion (username + class).
 * - Signed out → Google signup form.
 */
export default function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div
          className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-6"
          aria-busy="true"
          aria-label="Loading signup"
        >
          <div className="mx-auto h-8 w-40 animate-pulse rounded-md bg-line/80" />
          <div className="h-64 animate-pulse rounded-2xl bg-line/50" />
        </div>
      }
    >
      <SignupGate searchParams={searchParams} />
    </Suspense>
  );
}

async function SignupGate({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  await connection();
  const { next } = (await searchParams) ?? {};
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/submit";

  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    user = null;
  }

  if (user) {
    let profile = null;
    try {
      profile = await getCurrentProfile();
    } catch {
      profile = null;
    }
    if (profile) redirect("/");
    return <ProfileCompletion next={safeNext} />;
  }

  return <SignupForm />;
}
