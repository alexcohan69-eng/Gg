import { FollowButton } from "@/components/follow-button"
import { MessageButton } from "@/components/message-button"
import { Button } from "@/components/ui/button"

/** Closing call to action — "Get in touch" for visitors, "Make it yours" for the owner. */
export function ProfileAboutCta({
  isSelf,
  name,
  targetUserId,
  viewerFollows,
  profileIdentifier,
}: {
  isSelf: boolean
  name: string
  targetUserId: string
  viewerFollows: boolean
  profileIdentifier: string
}) {
  if (isSelf) {
    return (
      <section className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-heading text-lg font-semibold tracking-tight text-foreground">
            Make it yours
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Update your bio, links, and details to complete your profile.
          </p>
        </div>
        <Button className="rounded-full" nativeButton={false} render={<a href="/settings" />}>
          Edit profile
        </Button>
      </section>
    )
  }

  return (
    <section className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="font-heading text-lg font-semibold tracking-tight text-foreground">
          Get in touch
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Start a conversation or follow {name.split(" ")[0]} to stay in the loop.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <MessageButton targetUserId={targetUserId} />
        <FollowButton
          targetUserId={targetUserId}
          initialIsFollowing={viewerFollows}
          profileIdentifier={profileIdentifier}
          size="default"
        />
      </div>
    </section>
  )
}
