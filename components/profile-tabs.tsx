import Link from "next/link"
import { cn } from "@/lib/utils"

const TABS = [
  { key: "posts", label: "Posts", suffix: "" },
  { key: "work", label: "Work", suffix: "/work" },
  { key: "services", label: "Services", suffix: "/services" },
  { key: "testimonials", label: "Testimonials", suffix: "/testimonials" },
  { key: "about", label: "About", suffix: "/about" },
] as const

/**
 * Segmented Posts / Work / About nav shown at the top of every
 * profile sub-page. `identifier` is the username-or-id URL segment
 * (see lib/utils.ts's `profileHref`) — every tab links through it
 * rather than the bare `/profile` self-route, since `/profile/[username]`
 * already resolves the viewer's own profile correctly when the
 * identifier matches their own username or id.
 */
export function ProfileTabs({
  identifier,
  current,
}: {
  identifier: string
  current: "posts" | "work" | "services" | "testimonials" | "about"
}) {
  return (
    <nav
      aria-label="Profile sections"
      className="flex border-b border-border px-4"
    >
      {TABS.map((tab) => {
        const isActive = tab.key === current
        return (
          <Link
            key={tab.key}
            href={`/profile/${identifier}${tab.suffix}`}
            className={cn(
              "relative flex-1 px-2 py-3 text-center text-sm font-medium transition-colors",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {isActive ? (
              <span
                aria-hidden="true"
                className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-primary"
              />
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
