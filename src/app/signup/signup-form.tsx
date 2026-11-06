"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { GoogleButton } from "@/components/ui/GoogleButton";

/**
 * Signup — Google-only entry. After the Google redirect, users without a
 * profile land back here and see ProfileCompletion instead (handled by the
 * server page wrapper).
 */
export function SignupForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/submit";

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
        <h1 className="mt-4 text-2xl font-black tracking-tight text-ink">Join 2K27</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Create your account to submit and react. Your submissions stay anonymous.
        </p>
      </motion.div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-extrabold tracking-tight text-ink">Create your account</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Restricted to the school community. Your profile is always a student account.
          </p>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col gap-4">
            <GoogleButton next={next} />
            <p className="text-center text-sm text-ink-soft">
              Already have an account?{" "}
              <Link href="/login" className="font-bold text-ink underline underline-offset-2">
                Log in
              </Link>
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
