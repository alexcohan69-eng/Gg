import { FileTextIcon, MessagesSquareIcon, PackageCheckIcon, SparklesIcon } from "lucide-react"

const STEPS = [
  {
    title: "Share your brief",
    description: "Send your goals, references, and deadline so the scope is clear from day one.",
    icon: FileTextIcon,
  },
  {
    title: "Kickoff & first draft",
    description: "Work starts right away, with early direction shared for your feedback.",
    icon: SparklesIcon,
  },
  {
    title: "Refine together",
    description: "We go back and forth through revisions until every detail feels right.",
    icon: MessagesSquareIcon,
  },
  {
    title: "Final delivery",
    description: "You get polished, ready-to-use files, plus support after handoff.",
    icon: PackageCheckIcon,
  },
] as const

/** "How I'll work" — a generic four-step engagement timeline shown on every listing. */
export function ServiceProcess() {
  return (
    <div className="border-t border-border pt-6">
      <h2 className="mb-4 font-heading text-sm font-semibold tracking-tight text-foreground">
        How I&apos;ll work
      </h2>
      <ol className="flex flex-col gap-5">
        {STEPS.map((step, index) => {
          const Icon = step.icon
          const isLast = index === STEPS.length - 1
          return (
            <li key={step.title} className="relative flex gap-4">
              {!isLast ? (
                <span
                  className="absolute top-10 left-[19px] w-px bg-border"
                  style={{ height: "calc(100% - 0.5rem)" }}
                  aria-hidden="true"
                />
              ) : null}
              <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary shadow-sm">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5 pt-1.5">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Step {index + 1}
                </p>
                <p className="text-sm font-semibold text-foreground">{step.title}</p>
                <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{step.description}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
