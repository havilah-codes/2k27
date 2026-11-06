"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Flame } from "lucide-react";
import { NAV_ITEMS } from "@/lib/constants";
import { Avatar } from "@/components/ui/Avatar";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { signOut } from "@/app/auth/actions";
import { cn } from "@/lib/utils";

/** Desktop + top mobile header. Bottom tab bar lives in MobileNav. */
export function AppHeader() {
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);
  const [user, setUser] = useState<{ displayName: string; username: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      const supabase = createSupabaseBrowserClient();
      supabase.auth
        .getUser()
        .then(async ({ data }) => {
          if (cancelled || !data.user) return;
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, username")
            .eq("id", data.user.id)
            .single();
          if (!cancelled && profile) {
            setUser({
              displayName: profile.display_name,
              username: profile.username,
            });
          }
        })
        .catch(() => {});
    } catch {
      // No Supabase env configured — keep the placeholder identity.
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // Placeholder while the real profile loads (or when Supabase env is absent).
  const displayName = user?.displayName ?? "You";
  const username = user?.username ?? "anon";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-accent rounded-lg">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-paper">
            <Flame className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
          </span>
          <span className="text-lg font-black tracking-tight text-ink">
            2K27<span className="text-accent">.</span>
            <span className="ml-2 hidden text-xs font-semibold uppercase tracking-[0.16em] text-ink-faint sm:inline">
              Daily Comedy
            </span>
          </span>
        </Link>

        <nav aria-label="Primary" className="ml-8 hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-accent",
                  active ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-elevated hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setNotifOpen((v) => !v)}
              aria-label="Notifications"
              aria-expanded={notifOpen}
              className="rounded-full p-2 text-ink-soft transition-colors hover:bg-paper-elevated hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
            </button>
            <AnimatePresence>
              {notifOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.16 }}
                  className="absolute right-0 top-11 w-72 rounded-2xl border border-line bg-paper-elevated p-4 shadow-[var(--shadow-pop)]"
                >
                  <p className="text-sm font-bold text-ink">Notifications</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                    Today&apos;s collection drops at 4:00 PM. Check back after publication.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Link href="/profile" className="flex items-center gap-2 rounded-full p-1 focus-visible:outline-2 focus-visible:outline-accent">
            <Avatar name={displayName} size="sm" />
            <span className="hidden text-sm font-semibold text-ink md:inline">{username}</span>
          </Link>

          <form action={signOut}>
            <button
              type="submit"
              aria-label="Log out"
              className="rounded-full px-3 py-1.5 text-xs font-bold text-ink-soft transition-colors hover:bg-paper-elevated hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              Log out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
