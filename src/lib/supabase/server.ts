import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv, getSupabaseServiceRoleEnv } from "./env";
import { createClient } from "@supabase/supabase-js";

/**
 * Cookie-based server client for Server Components and Server Actions.
 * Uses the anon key with the caller's session, so RLS still applies.
 */
export async function createSupabaseServerClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // setAll called from a Server Component — safe to ignore;
            // session refresh will happen in middleware / server actions.
          }
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses RLS — server-only, for privileged
 * operations (moderation, admin). Never expose to the browser.
 */
export function createSupabaseAdminClient() {
  const { url, serviceRoleKey } = getSupabaseServiceRoleEnv();
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
