"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { GoogleButton } from "@/components/ui/GoogleButton";

/**
 * Login — Google-only. Email/password auth was removed (Stage 4 follow-up):
 * it was friction-prone (verification emails, rate-limit throttles) for a
 * student audience. All identity goes through Google OAuth.
 */
export default function LoginPage() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

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
        <h1 className="mt-4 text-2xl font-black tracking-tight text-ink">2K27 Daily Comedy</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Anonymous bits, published daily. Log in to submit and react.
        </p>
      </motion.div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-extrabold tracking-tight text-ink">Welcome back</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Sign in with your Google account. No password needed.
          </p>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col gap-4">
            <GoogleButton next={next} />
            <p className="text-center text-sm text-ink-soft">
              New to 2K27?{" "}
              <Link href="/signup" className="font-bold text-ink underline underline-offset-2">
                Create your account
              </Link>
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
