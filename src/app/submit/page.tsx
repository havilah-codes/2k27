import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser, getCurrentProfile } from "@/lib/supabase/auth";
import { SubmissionComposer } from "./composer";

/**
 * Submission page (Stage 4). The static shell (heading) prerenders instantly;
 * the auth-gated composer streams in behind a Suspense boundary (Next 16 PPR
 * rule: dynamic access must live inside Suspense).
 */
export default function SubmitPage() {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-sm font-medium text-ink-soft">Keep it anonymous. Keep it funny.</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-ink sm:text-4xl">
          Drop today&apos;s bit.
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft sm:text-base">
          Submissions are collected all day, scored for humour and originality, and the best are
          published in today&apos;s feed. Your identity is never revealed.
        </p>
      </header>

      <Suspense
        fallback={
          <div
            className="flex flex-col gap-4"
            aria-busy="true"
            aria-label="Loading submission form"
          >
            <div className="h-10 w-48 animate-pulse rounded-md bg-line/80" />
            <div className="h-40 animate-pulse rounded-2xl bg-line/50" />
          </div>
        }
      >
        <SubmitGate />
      </Suspense>
    </div>
  );
}

async function SubmitGate() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/submit");

  const profile = await getCurrentProfile();
  if (!profile) redirect("/signup");

  return <SubmissionComposer userId={user.id} />;
}
