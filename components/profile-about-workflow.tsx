import type { WorkflowStep } from "@/lib/db/schema"
import { AboutEmptyState, AboutSection } from "@/components/profile-about-section"

export function ProfileAboutWorkflow({
  steps,
  isSelf,
}: {
  steps: WorkflowStep[]
  isSelf: boolean
}) {
  if (steps.length === 0) {
    if (!isSelf) return null
    return (
      <AboutEmptyState
        title="Workflow"
        description="Outline the steps you take clients through, from kickoff to delivery."
        ctaLabel="Add workflow steps"
      />
    )
  }

  return (
    <AboutSection title="Workflow">
      <ol className="mt-4 flex flex-col gap-4">
        {steps.map((step, index) => (
          <li key={`${step.title}-${index}`} className="flex gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium text-foreground">{step.title}</p>
              {step.description ? (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </AboutSection>
  )
}
