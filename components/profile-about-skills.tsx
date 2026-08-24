import { AboutEmptyState, AboutSection } from "@/components/profile-about-section"
import { Badge } from "@/components/ui/badge"

export function ProfileAboutSkills({
  skills,
  isSelf,
}: {
  skills: string[]
  isSelf: boolean
}) {
  if (skills.length === 0) {
    if (!isSelf) return null
    return (
      <AboutEmptyState
        title="Skills"
        description="List the skills you want visitors to see first."
        ctaLabel="Add skills"
      />
    )
  }

  return (
    <AboutSection title="Skills">
      <div className="mt-4 flex flex-wrap gap-2">
        {skills.map((skill) => (
          <Badge key={skill} variant="secondary" className="rounded-full px-3 py-1">
            {skill}
          </Badge>
        ))}
      </div>
    </AboutSection>
  )
}
