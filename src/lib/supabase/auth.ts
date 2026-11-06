import { createSupabaseServerClient } from "./server";

export interface CurrentUser {
  id: string;
  email?: string | null;
}

export interface CurrentProfile {
  id: string;
  username: string;
  displayName: string;
  className: string;
  avatarUrl: string | null;
  role: "student" | "admin";
  createdAt: string;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }
  return user;
}

/** Fetch the authenticated user's own profile (RLS allows own + public reads). */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, class_name, avatar_url, role, created_at")
    .eq("id", user.id)
    .single();
  if (error || !data) return null;
  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    className: data.class_name,
    avatarUrl: data.avatar_url,
    role: data.role,
    createdAt: data.created_at,
  };
}

export async function isAdmin(): Promise<boolean> {
  const profile = await getCurrentProfile();
  return profile?.role === "admin";
}
