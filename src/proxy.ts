import { NextResponse, type NextRequest } from "next/server";
import { supabaseMiddleware } from "@/lib/supabase/middleware";
import { hasSupabaseEnv } from "@/lib/supabase/env";

/**
 * Next.js 16: middleware is exposed as `proxy`.
 * Session refresh + protected route gate for the app shell.
 * Passes through when Supabase env vars are not yet configured so the
 * Stage 3 UI stays inspectable.
 */
export async function proxy(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.next();
  }
  return supabaseMiddleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
