import Link from "next/link"
import { CalendarIcon, LinkIcon, MapPinIcon, StarIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { FollowButton } from "@/components/follow-button"
import { MessageButton } from "@/components/message-button"
import { BlockButton } from "@/components/block-button"
import { getInitials, pluralize } from "@/lib/utils"

/**
 * Banner/avatar/bio block shared by the self profile page (`/profile`)
 * and public profile page (`/profile/[identifier]`). Rendering this
 * from plain data — rather than each page duplicating the markup —
 * keeps both profile views visually identical as the profile grows.
 */
export function ProfileHeader({
  name,
  username,
  bio,
  image,
  bannerImage,
  website,
  location,
  joined,
  rating,
  totalProjects,
  profileIdentifier,
  isSelf,
  targetUserId,
  targetUserName,
  isFollowing,
  viewerBlockedTarget,
  targetBlockedViewer,
}: {
  name: string
  username: string | null
  bio: string | null
  image: string | null
  bannerImage: string | null
  website: string | null
  location: string | null
  joined: string
  /** Average across rated testimonials, 1 decimal. Null if none are rated yet. */
  rating: number | null
  /** Curated career total shown in the About tab's highlights. Null if not set. */
  totalProjects: number | null
  /** The username or id used in this profile's URL segment. */
  profileIdentifier: string
  isSelf: boolean
  /** Required when `isSelf` is false, to drive the follow button. */
  targetUserId?: string
  /** Required when `isSelf` is false, for block/report action labels and toasts. */
  targetUserName?: string
  /** Required when `isSelf` is false, to drive the follow button. */
  isFollowing?: boolean
  /** Required when `isSelf` is false. Whether the viewer has blocked this profile. */
  viewerBlockedTarget?: boolean
  /** Required when `isSelf` is false. Whether this profile has blocked the viewer. */
  targetBlockedViewer?: boolean
}) {
  // Either direction of a block severs the normal follow/message
  // affordances — the server actions already reject these, so hiding
  // them here just keeps the UI honest instead of surfacing an error.
  const interactionsBlocked = Boolean(viewerBlockedTarget || targetBlockedViewer)
  return (
    <div className="flex flex-col">
      <div
        className="h-36 w-full bg-gradient-to-br from-primary/40 via-accent to-primary/10 sm:h-48"
        style={
          bannerImage
            ? {
                backgroundImage: `url(${bannerImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      />

      <div className="px-4 pb-6">
        <div className="-mt-10 flex items-end justify-between sm:-mt-12">
          <Avatar className="size-20 border-4 border-background sm:size-24">
            <AvatarImage src={image ?? undefined} alt={name} />
            <AvatarFallback className="text-2xl">
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>

          {isSelf ? (
            <Button
              variant="outline"
              className="mt-10 rounded-full sm:mt-12"
              nativeButton={false}
              render={<a href="/settings" />}
            >
              Edit profile
            </Button>
          ) : (
            <div className="mt-10 flex items-center gap-2 sm:mt-12">
              {!interactionsBlocked ? (
                <>
                  <MessageButton targetUserId={targetUserId!} />
                  <FollowButton
                    targetUserId={targetUserId!}
                    initialIsFollowing={isFollowing!}
                    profileIdentifier={profileIdentifier}
                    size="default"
                  />
                </>
              ) : null}
              <BlockButton
                targetUserId={targetUserId!}
                targetUserName={targetUserName ?? name}
                profileIdentifier={profileIdentifier}
                initialIsBlocked={Boolean(viewerBlockedTarget)}
              />
            </div>
          )}
        </div>

        {!isSelf && targetBlockedViewer ? (
          <p className="mt-3 text-sm text-muted-foreground">
            This account has restricted interactions with you.
          </p>
        ) : null}

        <div className="mt-4 space-y-1">
          <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
            {name}
          </h2>
          <p className="text-sm text-muted-foreground">@{username ?? "user"}</p>
        </div>

        {/* Marks where the name/handle above scrolls out from under the
            sticky header, so ProfileStickyHeader knows when to reveal
            its own copy instead of showing both at once. */}
        <div
          id="profile-identity-sentinel"
          className="h-px w-full"
          aria-hidden="true"
        />

        {bio ? (
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-foreground">
            {bio}
          </p>
        ) : isSelf ? (
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
            Add a bio to tell people about yourself.
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {location ? (
            <span className="inline-flex items-center gap-1">
              <MapPinIcon className="size-4" aria-hidden="true" />
              {location}
            </span>
          ) : null}
          {website ? (
            <a
              href={website}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <LinkIcon className="size-4" aria-hidden="true" />
              {website.replace(/^https?:\/\//, "")}
            </a>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <CalendarIcon className="size-4" aria-hidden="true" />
            Joined {joined}
          </span>
        </div>

        <div className="mt-4 flex gap-5 text-sm">
          <Link
            href={`/profile/${profileIdentifier}/testimonials`}
            className="inline-flex items-center gap-1 hover:underline"
          >
            {rating != null ? (
              <StarIcon className="size-3.5 fill-primary text-primary" aria-hidden="true" />
            ) : null}
            <strong className="font-semibold text-foreground">
              {rating != null ? rating.toFixed(1) : "New"}
            </strong>{" "}
            <span className="text-muted-foreground">Rating</span>
          </Link>
          <Link
            href={`/profile/${profileIdentifier}/work`}
            className="hover:underline"
          >
            <strong className="font-semibold text-foreground">
              {totalProjects ?? 0}
            </strong>{" "}
            <span className="text-muted-foreground">
              {pluralize(totalProjects ?? 0, "Project")}
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}
