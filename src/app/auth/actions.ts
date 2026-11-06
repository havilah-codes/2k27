"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";

export type AuthResult = { ok: true; next: string } | { ok: false; message: string };

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;

function safeNext(next?: string | FormDataEntryValue | null): string {
  const value = typeof next === "string" ? next : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

/**
 * Complete a profile for an already-authenticated user (first-time Google
 * login). Role is always 'student'; the database trigger blocks escalation.
 */
export async function completeProfile(formData: FormData): Promise<AuthResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, message: "You must be signed in to finish setting up your profile." };
  }

  const username = String(formData.get("username") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const className = String(formData.get("className") ?? "").trim();
  const next = safeNext(formData.get("next"));

  if (!USERNAME_RE.test(username)) {
    return { ok: false, message: "Username must be 3–30 letters, numbers, dots or underscores." };
  }
  if (displayName.length < 1 || displayName.length > 60) {
    return { ok: false, message: "Display name must be 1–60 characters." };
  }
  if (className.length < 1 || className.length > 40) {
    return { ok: false, message: "Class must be 1–40 characters." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .limit(1);
  if (existing && existing.length > 0) {
    return { ok: true, next };
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: user.id,
    username,
    display_name: displayName,
    class_name: className,
    role: "student",
  });

  if (profileError) {
    return {
      ok: false,
      message:
        profileError.code === "23505"
          ? "That username is taken. Pick another."
          : "We couldn't create your profile. Please try again.",
    };
  }

  return { ok: true, next };
}

/** Logout. */
export async function signOut(): Promise<never> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Server-side guard helper (used by pages/actions). */
export async function requireAuthRedirect(redirectTo = "/login") {
  const user = await getCurrentUser();
  if (!user) redirect(`${redirectTo}?next=${encodeURIComponent("/")}`);
  return user;
}
