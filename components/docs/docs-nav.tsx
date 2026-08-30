"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * Sticky "jump to section" nav for the docs page. Horizontally
 * scrollable on mobile (matches the 393px preview viewport) and a
 * plain row on wider screens. Highlights the group currently in view
 * via IntersectionObserver rather than scroll math.
 */
export function DocsNav({ groups }: { groups: { id: string; title: string }[] }) {
  const [activeId, setActiveId] = useState(groups[0]?.id)

  useEffect(() => {
    const sections = groups
      .map((group) => document.getElementById(group.id))
      .filter((el): el is HTMLElement => el !== null)

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting)
        if (visible) setActiveId(visible.target.id)
      },
      { rootMargin: "-96px 0px -70% 0px" },
    )

    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [groups])

  return (
    <nav
      aria-label="API sections"
      className="sticky top-0 z-10 -mx-6 flex gap-2 overflow-x-auto border-b border-border bg-background/95 px-6 py-3 backdrop-blur-sm sm:mx-0 sm:flex-wrap sm:overflow-visible sm:rounded-xl sm:border sm:px-3"
    >
      {groups.map((group) => (
        <a
          key={group.id}
          href={`#${group.id}`}
          className={cn(
            "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
            activeId === group.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {group.title}
        </a>
      ))}
    </nav>
  )
}
