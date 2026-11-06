"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Flame, Home, Trophy, User } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/submit", label: "Submit", Icon: Flame },
  { href: "/hall-of-fame", label: "Fame", Icon: Trophy },
  { href: "/profile", label: "Profile", Icon: User },
];

/** Thumb-friendly bottom tab bar for mobile. Desktop uses AppHeader nav. */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid max-w-md grid-cols-4">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors",
                active ? "text-ink" : "text-ink-faint hover:text-ink",
              )}
            >
              {active && (
                <motion.span
                  layoutId="mobile-nav-active"
                  className="absolute -top-px h-0.5 w-10 rounded-full bg-accent"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <Icon className={cn("h-5 w-5", active && href === "/submit" && "text-accent")} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
