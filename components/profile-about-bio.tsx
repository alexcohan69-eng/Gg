import { isHtmlContentEmpty, sanitizePostHtml } from "@/lib/sanitize-html"
import { AboutSection } from "@/components/profile-about-section"
import { Button } from "@/components/ui/button"

/** Rich-text "About" narrative written from settings. */
export function ProfileAboutBio({
  about,
  isSelf,
  name,
}: {
  about: string | null
  isSelf: boolean
  name: string
}) {
  const hasAbout = about && !isHtmlContentEmpty(about)

  return (
    <AboutSection title="About">
      {hasAbout ? (
        <div
          className="prose-post mt-3 text-pretty break-words text-base leading-relaxed text-foreground"
          // Sanitized again here (defense-in-depth) even though updateAbout
          // already sanitizes before storing.
          dangerouslySetInnerHTML={{ __html: sanitizePostHtml(about!) }}
        />
      ) : (
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          {isSelf
            ? "You haven't written an about section yet. Add one from settings to introduce yourself."
            : `${name} hasn't written an about section yet.`}
        </p>
      )}
      {isSelf && !hasAbout ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-4 rounded-full"
          nativeButton={false}
          render={<a href="/settings" />}
        >
          Add an about section
        </Button>
      ) : null}
    </AboutSection>
  )
}
