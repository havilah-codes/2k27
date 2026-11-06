"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** "Continue with Google" button — starts Supabase OAuth flow. */
export function GoogleButton({ next = "/submit" }: { next?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setPending(false);
      }
    } catch {
      setError("Google login isn't available right now. Try email instead.");
      setPending(false);
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-line-strong bg-paper-elevated font-semibold text-ink transition-colors hover:border-ink/40 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {pending ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-5 w-5 items-center justify-center rounded-full text-sm font-black text-[#4285f4]"
          >
            G
          </span>
        )}
        Continue with Google
      </button>
      {error && (
        <p
          className="mt-2 rounded-xl bg-roast-soft px-4 py-2.5 text-xs font-semibold text-roast"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      <span className="text-xs font-semibold text-ink-faint">or</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
