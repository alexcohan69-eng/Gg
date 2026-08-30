"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import useSWR from "swr"
import { Menu, LogOut, ShieldIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { Logo } from "@/components/logo"
import { UserMenu } from "@/components/user-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { NAV_ITEMS, MOBILE_TAB_ITEMS } from "@/lib/nav-items"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

type ShellUser = {
  name: string
  email: string
  image?: string | null
  username?: string | null
}

/** Small unread-count dot rendered on top of a nav icon. Caps the
 * visible label at "9+" so it never wraps or crowds the icon. */
function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span
      className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
      aria-hidden="true"
    >
      {count > 9 ? "9+" : count}
    </span>
  )
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** Light/dark toggle styled to match the sidebar nav rows. The icon
 * *and* label switch purely via the `dark:` CSS class — like
 * next-themes' own docs recommend — rather than branching JSX on
 * `resolvedTheme`, which is `undefined` on the server and would
 * otherwise render different text server- vs client-side and trip a
 * hydration mismatch. `resolvedTheme` is only read inside the click
 * handler, which is client-only, so it's safe to use there. */
function ThemeToggleRow({ variant }: { variant: "desktop" | "mobile" }) {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn(
        "flex items-center gap-4 rounded-full px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-accent",
        variant === "desktop" && "justify-center lg:justify-start",
      )}
      aria-label="Toggle color theme"
    >
      <span className="relative shrink-0">
        <SunIcon className="hidden size-6 dark:inline" aria-hidden="true" />
        <MoonIcon className="inline size-6 dark:hidden" aria-hidden="true" />
      </span>
      <span className={cn(variant === "desktop" && "hidden lg:inline")}>
        <span className="hidden dark:inline">Light mode</span>
        <span className="inline dark:hidden">Dark mode</span>
      </span>
    </button>
  )
}

type BadgeCounts = { unreadNotificationsCount: number; unreadMessagesCount: number }

async function badgeCountsFetcher(url: string): Promise<BadgeCounts> {
  const response = await fetch(url)
  if (!response.ok) throw new Error("Failed to load badge counts")
  return response.json()
}

const BADGE_POLL_INTERVAL_MS = 15000

function badgeCountForHref(
  href: string,
  unreadNotificationsCount: number,
  unreadMessagesCount: number,
) {
  if (href === "/notifications") return unreadNotificationsCount
  if (href === "/messages") return unreadMessagesCount
  return 0
}

export function AppShell({
  user,
  unreadNotificationsCount: initialUnreadNotificationsCount = 0,
  unreadMessagesCount: initialUnreadMessagesCount = 0,
  isAdmin = false,
  openReportCount = 0,
  children,
}: {
  user: ShellUser
  unreadNotificationsCount?: number
  unreadMessagesCount?: number
  /** Whether the signed-in user is an admin (see lib/admin.ts). Controls visibility of the moderation link only — never used for actual access control. */
  isAdmin?: boolean
  openReportCount?: number
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)

  // Polls the notifications/messages badge counts so they stay live
  // for events another user causes (a like, a new message) while the
  // viewer sits on an unrelated page — not just after the viewer's own
  // actions, which already refresh via revalidatePath. Seeded with the
  // server-rendered counts from app/(app)/layout.tsx so there's no
  // flash on first paint, and this persists across client-side
  // navigation since AppShell itself doesn't remount between pages.
  const { data: badgeCounts } = useSWR<BadgeCounts>(
    "/api/badges",
    badgeCountsFetcher,
    {
      fallbackData: {
        unreadNotificationsCount: initialUnreadNotificationsCount,
        unreadMessagesCount: initialUnreadMessagesCount,
      },
      refreshInterval: BADGE_POLL_INTERVAL_MS,
      revalidateOnFocus: true,
    },
  )

  const unreadNotificationsCount =
    badgeCounts?.unreadNotificationsCount ?? initialUnreadNotificationsCount
  const unreadMessagesCount =
    badgeCounts?.unreadMessagesCount ?? initialUnreadMessagesCount

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/sign-in")
    router.refresh()
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-6xl">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-svh w-20 shrink-0 flex-col justify-between border-r border-border px-2 py-4 md:flex lg:w-64 lg:px-4">
        <div className="flex flex-col gap-2">
          <Link href="/home" className="flex items-center justify-center px-2 py-3 lg:justify-start">
            <Logo className="hidden lg:inline-flex" />
            <Logo iconOnly className="lg:hidden" />
          </Link>
          <nav aria-label="Primary" className="mt-2 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-center gap-4 rounded-full px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-accent lg:justify-start",
                    active && "bg-accent text-accent-foreground font-semibold",
                  )}
                >
                  <span className="relative shrink-0">
                    <item.icon className="size-6" aria-hidden="true" />
                    <NavBadge
                      count={badgeCountForHref(
                        item.href,
                        unreadNotificationsCount,
                        unreadMessagesCount,
                      )}
                    />
                  </span>
                  <span className="hidden lg:inline">{item.label}</span>
                </Link>
              )
            })}
            {isAdmin ? (
              <Link
                href="/admin"
                aria-current={isActive(pathname, "/admin") ? "page" : undefined}
                className={cn(
                  "flex items-center justify-center gap-4 rounded-full px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-accent lg:justify-start",
                  isActive(pathname, "/admin") && "bg-accent text-accent-foreground font-semibold",
                )}
              >
                <span className="relative shrink-0">
                  <ShieldIcon className="size-6" aria-hidden="true" />
                  <NavBadge count={openReportCount} />
                </span>
                <span className="hidden lg:inline">Moderation</span>
              </Link>
            ) : null}
          </nav>
        </div>
        <div className="flex flex-col gap-2">
          <ThemeToggleRow variant="desktop" />
          <UserMenu user={user} />
        </div>
      </aside>

      {/* Main content column */}
      <div className="flex min-h-svh flex-1 flex-col border-r border-border">
        {/* Mobile top bar. Fixed at h-14 (rather than letting padding
            size it) so other sticky headers below it — e.g.
            ProfileStickyHeader — can reserve the same offset and
            stack underneath instead of overlapping it once scrolled. */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-sm md:hidden">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu aria-hidden="true" />
                </Button>
              }
            />
            <SheetContent side="left" className="w-72">
              <SheetHeader>
                <SheetTitle className="sr-only">Navigation menu</SheetTitle>
                <Logo />
              </SheetHeader>
              <div className="flex flex-1 flex-col justify-between overflow-y-auto px-4 pb-4">
                <nav aria-label="Primary" className="flex flex-col gap-1">
                  {NAV_ITEMS.map((item) => {
                    const active = isActive(pathname, item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSheetOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-4 rounded-full px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-accent",
                          active &&
                            "bg-accent text-accent-foreground font-semibold",
                        )}
                      >
                        <span className="relative shrink-0">
                          <item.icon className="size-6" aria-hidden="true" />
                          <NavBadge
                            count={badgeCountForHref(
                              item.href,
                              unreadNotificationsCount,
                              unreadMessagesCount,
                            )}
                          />
                        </span>
                        {item.label}
                      </Link>
                    )
                  })}
                  {isAdmin ? (
                    <Link
                      href="/admin"
                      onClick={() => setSheetOpen(false)}
                      aria-current={isActive(pathname, "/admin") ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-4 rounded-full px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-accent",
                        isActive(pathname, "/admin") &&
                          "bg-accent text-accent-foreground font-semibold",
                      )}
                    >
                      <span className="relative shrink-0">
                        <ShieldIcon className="size-6" aria-hidden="true" />
                        <NavBadge count={openReportCount} />
                      </span>
                      Moderation
                    </Link>
                  ) : null}
                </nav>
                <div className="flex flex-col gap-1 border-t border-border pt-4">
                  <ThemeToggleRow variant="mobile" />
                  <Button
                    variant="ghost"
                    className="justify-start gap-4 px-3 text-base font-medium"
                    onClick={handleSignOut}
                  >
                    <LogOut className="size-5" aria-hidden="true" />
                    Sign out
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Link href="/home" aria-label="Web Banai home">
            <Logo />
          </Link>

          <Link href="/profile" aria-label="Your profile">
            <Avatar className="size-8">
              <AvatarImage src={user.image ?? undefined} alt={user.name} />
              <AvatarFallback>{initials(user.name)}</AvatarFallback>
            </Avatar>
          </Link>
        </header>

        <main className="flex-1 pb-16 md:pb-0">{children}</main>

        {/* Mobile bottom tab bar */}
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-background/95 py-2 backdrop-blur-sm md:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {MOBILE_TAB_ITEMS.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                className={cn(
                  "flex flex-1 items-center justify-center rounded-full p-3 text-foreground",
                  active && "text-primary",
                )}
              >
                <span className="relative">
                  <item.icon className="size-6" aria-hidden="true" />
                  <NavBadge
                    count={badgeCountForHref(
                      item.href,
                      unreadNotificationsCount,
                      unreadMessagesCount,
                    )}
                  />
                </span>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
