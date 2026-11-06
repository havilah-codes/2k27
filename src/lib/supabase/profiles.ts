"use server";

import { createSupabaseServerClient } from "./server";
import { requireUser } from "./auth";

export interface PublicProfile {
  id: string;
  username: string;
  displayName: string;
  className: string;
  avatarUrl: string | null;
}

/** Strip PostgREST filter metacharacters from user search input. */
function sanitizeQuery(q: string): string {
  return q.replace(/[%(),%;"]/g, "").trim();
}

/**
 * Recipient search for the submission flow. Returns only public profile
 * fields (display name + class) — never emails, roles or auth data.
 */
export async function searchEligibleRecipients(
  currentUserId: string,
  query: string,
  limit = 30,
): Promise<{ recipients: PublicProfile[]; error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const q = sanitizeQuery(query);

  let request = supabase
    .from("profiles")
    .select("id, username, display_name, class_name, avatar_url")
    .neq("id", currentUserId)
    .order("display_name", { ascending: true })
    .limit(limit);

  if (q) {
    request = request.or(
      `display_name.ilike.%${q}%,username.ilike.%${q}%,class_name.ilike.%${q}%`,
    );
  }

  const { data, error } = await request;
  if (error) {
    return { recipients: [], error: "Could not load classmates. Please try again." };
  }

  const blocked = await getBlockedUserIds(currentUserId);
  const recipients = (data ?? [])
    .filter((p) => !blocked.has(p.id))
    .map((p) => ({
      id: p.id,
      username: p.username,
      displayName: p.display_name,
      className: p.class_name,
      avatarUrl: p.avatar_url,
    }));

  return { recipients, error: null };
}

/**
 * Totally random eligible recipient (server-side selection among eligible
 * users, excluding self and mutually blocked/blocking relationships).
 */
export async function pickRandomRecipient(
  currentUserId: string,
): Promise<{ recipient: PublicProfile | null; error: string | null }> {
  const supabase = await createSupabaseServerClient();

  const blocked = await getBlockedUserIds(currentUserId);

  let request = supabase
    .from("profiles")
    .select("id, username, display_name, class_name, avatar_url")
    .neq("id", currentUserId);

  if (blocked.size > 0) {
    request = request.not("id", "in", `(${[...blocked].join(",")})`);
  }

  const { data, error } = await request;
  if (error) {
    return { recipient: null, error: "Could not pick a random classmate. Please try again." };
  }
  if (!data || data.length === 0) {
    return { recipient: null, error: "No eligible classmates found yet." };
  }

  const pick = data[Math.floor(Math.random() * data.length)];
  return {
    recipient: {
      id: pick.id,
      username: pick.username,
      displayName: pick.display_name,
      className: pick.class_name,
      avatarUrl: pick.avatar_url,
    },
    error: null,
  };
}

/** IDs the user has blocked plus IDs who blocked the user (both directions). */
async function getBlockedUserIds(userId: string): Promise<Set<string>> {
  const supabase = await createSupabaseServerClient();
  const ids = new Set<string>();

  const [{ data: outgoing }, { data: incoming }] = await Promise.all([
    supabase.from("blocks").select("blocked_id").eq("blocker_id", userId),
    supabase.from("blocks").select("blocker_id").eq("blocked_id", userId),
  ]);

  for (const row of outgoing ?? []) ids.add(row.blocked_id);
  for (const row of incoming ?? []) ids.add(row.blocker_id);
  return ids;
}

/** Is there any block relationship in either direction between two users? */
export async function hasBlockRelationship(a: string, b: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("blocks")
    .select("id")
    .or(`and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`)
    .limit(1);
  return Boolean(data && data.length > 0);
}

export async function recipientExists(recipientId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", recipientId)
    .limit(1);
  return Boolean(data && data.length > 0);
}

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;

export interface UpdateProfileInput {
  username?: unknown;
  displayName?: unknown;
  className?: unknown;
}

export type UpdateProfileResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

/**
 * Update the caller's own profile. Only username / display name / class.
 * Role is never accepted here (DB trigger blocks escalation anyway).
 */
export async function updateProfile(input: UpdateProfileInput): Promise<UpdateProfileResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, message: "You must be signed in." };
  }

  const username = String(input.username ?? "").trim();
  const displayName = String(input.displayName ?? "").trim();
  const className = String(input.className ?? "").trim();

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
  const { error } = await supabase
    .from("profiles")
    .update({ username, display_name: displayName, class_name: className })
    .eq("id", user.id);

  if (error) {
    return {
      ok: false,
      message:
        error.code === "23505"
          ? "That username is taken. Pick another."
          : "We couldn't save your profile. Please try again.",
    };
  }

  return { ok: true, message: "Profile saved." };
}
