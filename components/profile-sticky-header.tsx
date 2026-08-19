"use client"

import { useEffect, useRef, useState } from "react"
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
 * On mobile this header stacks below AppShell's own sticky top bar
 * (via `top-14`, matching that bar's fixed height) rather than at
 * `top-0`, otherwise both would land on the same sticky position and
 * overlap once scrolled. That offset is read back from the DOM (this
 * header's own resolved `top`) instead of duplicating the `56` number
 * into the IntersectionObserver's rootMargin, so the two can't drift
 * out of sync, and it stays correct if AppShell's bar height changes.
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
  const headerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const sentinelEl = document.getElementById("profile-identity-sentinel")
    const headerEl = headerRef.current
    if (!sentinelEl || !headerEl) return

    let observer: IntersectionObserver | undefined

    // TS resets narrowing across a closure boundary, even for `const`
    // bindings, so the non-null check above doesn't carry into this
    // nested function. The `!` assertions are safe: sentinelEl/headerEl
    // are never reassigned after the guard, on this or any later call.
    function observeWithCurrentOffset() {
      const sentinel = sentinelEl!
      const header = headerEl!
      observer?.disconnect()
      const stickyTop = Number.parseFloat(getComputedStyle(header).top) || 0
      observer = new IntersectionObserver(
        ([entry]) => setRevealed(!entry.isIntersecting),
        { rootMargin: `-${stickyTop}px 0px 0px 0px` },
      )
      observer.observe(sentinel)
    }

    observeWithCurrentOffset()
    // Re-measure on resize since the sticky offset changes at the
    // md breakpoint (AppShell's mobile bar disappears).
    window.addEventListener("resize", observeWithCurrentOffset)
    return () => {
      window.removeEventListener("resize", observeWithCurrentOffset)
      observer?.disconnect()
    }
  }, [])

  return (
    <header
      ref={headerRef}
      className="sticky top-14 z-30 flex items-center justify-between gap-4 border-b border-border bg-background/95 px-4 py-4 backdrop-blur-sm md:top-0"
    >
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
