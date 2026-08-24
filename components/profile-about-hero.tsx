import { AtSignIcon, BadgeCheckIcon, CalendarIcon, MapPinIcon } from "lucide-react"
import type { ProfileUser } from "@/lib/follows"
import { getInitials } from "@/lib/utils"
import { FollowButton } from "@/components/follow-button"
import { MessageButton } from "@/components/message-button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

/** Banner, avatar, identity, and primary actions at the top of the About page. */
export function ProfileAboutHero({
  profile,
  isSelf,
  viewerFollows,
  memberSince,
}: {
  profile: ProfileUser
  isSelf: boolean
  viewerFollows: boolean
  memberSince: string
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div
        className="h-28 w-full bg-gradient-to-br from-primary/40 via-accent to-primary/10 sm:h-36"
        style={
          profile.bannerImage
            ? {
                backgroundImage: `url(${profile.bannerImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
        aria-hidden="true"
      />

      <div className="px-5 pb-5">
        <div className="-mt-12 flex items-end justify-between gap-3">
          <Avatar className="size-24 border-4 border-card">
            <AvatarImage src={profile.image ?? undefined} alt={profile.name} />
            <AvatarFallback className="text-2xl">{getInitials(profile.name)}</AvatarFallback>
          </Avatar>

          <div className="mb-1 flex items-center gap-2">
            {isSelf ? (
              <Button
                variant="outline"
                className="rounded-full"
                nativeButton={false}
                render={<a href="/settings" />}
              >
                Edit profile
              </Button>
            ) : (
              <>
                <MessageButton targetUserId={profile.id} />
                <FollowButton
                  targetUserId={profile.id}
                  initialIsFollowing={viewerFollows}
                  profileIdentifier={profile.username ?? profile.id}
                  size="default"
                />
              </>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground text-balance">
              {profile.name}
            </h2>
            <BadgeCheckIcon className="size-5 shrink-0 text-primary" aria-label="Verified member" />
          </div>
          <p className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <AtSignIcon className="size-3.5" aria-hidden="true" />
            {profile.username ?? "user"}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
              Open to connections
            </span>
            {profile.location ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                <MapPinIcon className="size-3.5" aria-hidden="true" />
                {profile.location}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
              <CalendarIcon className="size-3.5" aria-hidden="true" />
              Since {memberSince}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
