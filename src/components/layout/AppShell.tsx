"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { AppHeader } from "./AppHeader";
import { MobileNav } from "./MobileNav";
import { cn } from "@/lib/utils";

const PUBLIC_ROUTES = ["/login", "/signup"];

/**
 * Authenticated app shell. Public auth routes render without chrome;
 * everything else gets the header, content column and mobile tab bar.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_ROUTES.includes(pathname);

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pt-8">{children}</main>
      <footer className="mx-auto hidden w-full max-w-6xl px-6 pb-8 text-xs text-ink-faint lg:block">
        <p>Anonymous submissions. Admins can investigate abuse; the public feed never reveals senders.</p>
      </footer>
      <MobileNav />
      {/* Invisible marker for future auth-guard wiring */}
      <span className={cn("hidden", pathname && "ui-shell")} />
    </div>
  );
}
