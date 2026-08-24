import { ArrowUpRightIcon, type MapPinIcon } from "lucide-react"
import { AboutSection } from "@/components/profile-about-section"

export type AboutDetail = {
  key: string
  icon: typeof MapPinIcon
  label: string
  value: string
  href?: string
}

/** Contact / info list — location, website, email, member-since date. */
export function ProfileAboutDetails({ details }: { details: AboutDetail[] }) {
  return (
    <AboutSection title="Details">
      <dl className="mt-4 flex flex-col divide-y divide-border">
        {details.map((detail) => {
          const Icon = detail.icon
          return (
            <div key={detail.key} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <dt className="text-xs text-muted-foreground">{detail.label}</dt>
                <dd className="truncate text-sm font-medium text-foreground">
                  {detail.href ? (
                    <a
                      href={detail.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      {detail.value}
                      <ArrowUpRightIcon className="size-3.5" aria-hidden="true" />
                    </a>
                  ) : (
                    detail.value
                  )}
                </dd>
              </div>
            </div>
          )
        })}
      </dl>
    </AboutSection>
  )
}
