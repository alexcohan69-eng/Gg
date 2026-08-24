import type { BriefcaseIcon } from "lucide-react"
import { AboutEmptyState } from "@/components/profile-about-section"

export type CareerHighlight = {
  label: string
  value: string
  icon: typeof BriefcaseIcon
}

/** Metrics strip — years of experience, clients, projects. */
export function ProfileAboutCareerHighlights({
  highlights,
  isSelf,
}: {
  highlights: CareerHighlight[]
  isSelf: boolean
}) {
  if (highlights.length === 0) {
    if (!isSelf) return null
    return (
      <AboutEmptyState
        title="Career highlights"
        description="Add your years of experience, client count, and project count from settings to show a metrics strip here."
        ctaLabel="Add career highlights"
      />
    )
  }

  return (
    <section aria-label="Career highlights" className="grid grid-cols-3 gap-3">
      {highlights.map((stat) => {
        const Icon = stat.icon
        return (
          <div
            key={stat.label}
            className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
          >
            <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="font-heading text-xl font-semibold tracking-tight text-foreground">
              {stat.value}
            </span>
            <span className="text-xs text-muted-foreground">{stat.label}</span>
          </div>
        )
      })}
    </section>
  )
}
