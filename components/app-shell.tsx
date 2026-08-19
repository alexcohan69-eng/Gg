"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Menu, LogOut } from "lucide-react"
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

export function AppShell({
  user,
  children,
}: {
  user: ShellUser
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)

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
                  <item.icon className="size-6 shrink-0" aria-hidden="true" />
                  <span className="hidden lg:inline">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
        <UserMenu user={user} />
      </aside>

      {/* Main content column */}
      <div className="flex min-h-svh flex-1 flex-col border-r border-border">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm md:hidden">
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
                        <item.icon className="size-6 shrink-0" aria-hidden="true" />
                        {item.label}
                      </Link>
                    )
                  })}
                </nav>
                <Button
                  variant="ghost"
                  className="mt-4 justify-start gap-4 px-3 text-base font-medium"
                  onClick={handleSignOut}
                >
                  <LogOut className="size-5" aria-hidden="true" />
                  Sign out
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <Link href="/home" aria-label="Pulse home">
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
                <item.icon className="size-6" aria-hidden="true" />
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
