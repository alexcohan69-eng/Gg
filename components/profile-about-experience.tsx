import { ListChecksIcon } from "lucide-react"
import type { WorkExperienceEntry } from "@/lib/career"
import { AboutEmptyState, AboutSection } from "@/components/profile-about-section"

/** Career timeline built from the user's past roles. */
export function ProfileAboutExperience({
  entries,
  isSelf,
}: {
  entries: WorkExperienceEntry[]
  isSelf: boolean
}) {
  if (entries.length === 0) {
    if (!isSelf) return null
    return (
      <AboutEmptyState
        title="Experience"
        description="Add your past roles to build out your career timeline."
        ctaLabel="Add experience"
      />
    )
  }

  return (
    <AboutSection title="Experience">
      <ol className="mt-4 flex flex-col">
        {entries.map((entry, index) => (
          <li key={entry.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                <ListChecksIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              </span>
              {index < entries.length - 1 ? (
                <span className="my-1 w-px flex-1 bg-border" aria-hidden="true" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1 pb-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-medium text-foreground">
                  {entry.role}
                  <span className="text-muted-foreground"> · {entry.company}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {entry.startDate} — {entry.isCurrent ? "Present" : entry.endDate ?? "Present"}
                </p>
              </div>
              {entry.description ? (
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {entry.description}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </AboutSection>
  )
}
