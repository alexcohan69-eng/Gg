"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * Sticky top bar used on profile pages only. Visually matches
 * `PageHeader` (same sticky/blur/border classes), but is a separate
 * component rather than a `PageHeader` variant: its title only fades
 * in once the viewer scrolls past the profile card's own name/handle
 * (tracked via the `#profile-identity-sentinel` marker rendered by
 * `ProfileHeader`), so the same identity isn't shown twice on screen
 * at once. `PageHeader` itself is used by every other page and stays
 * untouched — they all want their title visible immediately.
 *
 * The name/handle stay in the DOM at all times (only their opacity
 * animates), so screen readers still get an immediate page heading on
 * load — this is a sighted-user-only visual refinement.
 */
export function ProfileStickyHeader({
  name,
  username,
  leading,
}: {
  name: string
  username: string
  leading?: React.ReactNode
}) {
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const sentinel = document.getElementById("profile-identity-sentinel")
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => setRevealed(!entry.isIntersecting),
      { rootMargin: "-64px 0px 0px 0px" },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-background/95 px-4 py-4 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        {leading}
        <div
          className={cn(
            "transition-opacity duration-200",
            revealed ? "opacity-100" : "opacity-0",
          )}
        >
          <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
            {name}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">@{username}</p>
        </div>
      </div>
    </header>
  )
}
