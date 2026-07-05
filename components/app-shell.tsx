"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { Bell, CarTaxiFront, CirclePlus, CircleUser, Search } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const TABS = [
  { href: "/", label: t("tab_search"), icon: Search },
  { href: "/post", label: t("tab_post"), icon: CirclePlus },
  { href: "/activity", label: t("tab_activity"), icon: CarTaxiFront },
  { href: "/notifications", label: t("tab_notifications"), icon: Bell },
  { href: "/profile", label: t("tab_profile"), icon: CircleUser },
] as const;

/** Live unread-count dot on the notifications tab; hidden at 0 / signed out. */
function UnreadBadge() {
  const { isAuthenticated } = useConvexAuth();
  const count = useQuery(
    api.notifications.unreadCount,
    isAuthenticated ? {} : "skip",
  );
  if (count === undefined || count === 0) return null;
  return (
    <span
      aria-label={t("unread_notifications")}
      className="absolute -top-1 -end-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white"
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/" || pathname.startsWith("/route") || pathname.startsWith("/trips") || pathname.startsWith("/requests");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-4">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-heading text-xl font-bold text-primary">
              {t("app_name")}
            </span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {t("app_tagline")}
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {TABS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                  isActive(pathname, href)
                    ? "bg-secondary font-semibold text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <span className="relative">
                  <Icon size={16} aria-hidden />
                  {href === "/notifications" && <UnreadBadge />}
                </span>
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-4 md:pb-8">
        {children}
      </main>

      <nav
        aria-label={t("app_name")}
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden"
      >
        <div className="pb-safe mx-auto flex max-w-2xl items-stretch justify-around pt-1">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-w-14 flex-col items-center gap-0.5 rounded-md px-2 py-1 text-[11px]",
                  active ? "font-semibold text-primary" : "text-muted-foreground",
                )}
              >
                <span className="relative">
                  <Icon
                    size={22}
                    strokeWidth={active ? 2.4 : 1.8}
                    aria-hidden
                  />
                  {href === "/notifications" && <UnreadBadge />}
                </span>
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
