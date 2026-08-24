import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"

/** Shared card shell used by every "About" page section for a consistent look. */
export function AboutSection({
  title,
  children,
  className = "",
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-5 ${className}`}>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  )
}

/**
 * Dashed-border placeholder shown to the profile owner when a section
 * (skills, workflow, experience, career highlights) has no content yet.
 */
export function AboutEmptyState({
  title,
  description,
  ctaLabel,
}: {
  title: string
  description: string
  ctaLabel: string
}) {
  return (
    <section className="rounded-2xl border border-dashed border-border bg-card/50 p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <Button
        variant="outline"
        size="sm"
        className="mt-4 rounded-full"
        nativeButton={false}
        render={<a href="/settings" />}
      >
        {ctaLabel}
      </Button>
    </section>
  )
}
