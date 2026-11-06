"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Flame, Loader2 } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, FieldLabel } from "@/components/ui/Input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { completeProfile } from "@/app/auth/actions";

/**
 * Profile completion for users who are already authenticated but have no
 * profile yet (first-time Google logins). Prefills display name from the
 * Google account and only asks for username + class.
 */
export function ProfileCompletion({ next = "/submit" }: { next?: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    try {
      const supabase = createSupabaseBrowserClient();
      supabase.auth
        .getUser()
        .then(({ data }) => {
          if (cancelled) return;
          const meta = data.user?.user_metadata ?? {};
          const name = String(meta.full_name ?? meta.name ?? "");
          if (name) setDisplayName(name);
        })
        .catch(() => {});
    } catch {
      // best-effort prefill only
    }
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("next", next);
    startTransition(async () => {
      const result = await completeProfile(formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(result.next);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col items-center text-center"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-paper">
          <Flame className="h-6 w-6" strokeWidth={2.4} aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-black tracking-tight text-ink">Almost there</h1>
        <p className="mt-1 text-sm text-ink-soft">
          You&apos;re signed in with Google. Just set up your 2K27 profile.
        </p>
      </motion.div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-extrabold tracking-tight text-ink">Your profile</h2>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <FieldLabel htmlFor="username">Username</FieldLabel>
              <Input
                id="username"
                name="username"
                required
                minLength={3}
                maxLength={30}
                pattern="[a-zA-Z0-9_.]+"
                title="3–30 letters, numbers, dots or underscores"
                autoComplete="username"
              />
              <p className="mt-1 text-xs text-ink-faint">
                3–30 letters, numbers, dots or underscores.
              </p>
            </div>
            <div>
              <FieldLabel htmlFor="displayName">Display name</FieldLabel>
              <Input
                id="displayName"
                name="displayName"
                required
                minLength={1}
                maxLength={60}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="className">Class</FieldLabel>
              <Input
                id="className"
                name="className"
                required
                minLength={1}
                maxLength={40}
                placeholder="e.g. Year 11"
              />
            </div>
            {error && (
              <p
                className="rounded-xl bg-roast-soft px-4 py-3 text-sm font-semibold text-roast"
                role="alert"
              >
                {error}
              </p>
            )}
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Setting up…
                </>
              ) : (
                "Finish setup"
              )}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
