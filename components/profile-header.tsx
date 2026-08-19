import Link from "next/link"
import { CalendarIcon, LinkIcon, MapPinIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { FollowButton } from "@/components/follow-button"
import { MessageButton } from "@/components/message-button"
import { getInitials } from "@/lib/utils"

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
  followerCount,
  followingCount,
  profileIdentifier,
  isSelf,
  targetUserId,
  isFollowing,
}: {
  name: string
  username: string | null
  bio: string | null
  image: string | null
  bannerImage: string | null
  website: string | null
  location: string | null
  joined: string
  followerCount: number
  followingCount: number
  /** The username or id used in this profile's URL segment. */
  profileIdentifier: string
  isSelf: boolean
  /** Required when `isSelf` is false, to drive the follow button. */
  targetUserId?: string
  /** Required when `isSelf` is false, to drive the follow button. */
  isFollowing?: boolean
}) {
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
              <MessageButton targetUserId={targetUserId!} />
              <FollowButton
                targetUserId={targetUserId!}
                initialIsFollowing={isFollowing!}
                profileIdentifier={profileIdentifier}
                size="default"
              />
            </div>
          )}
        </div>

        <div className="mt-4 space-y-1">
          <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
            {name}
          </h2>
          <p className="text-sm text-muted-foreground">@{username ?? "user"}</p>
        </div>

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
            href={`/profile/${profileIdentifier}/following`}
            className="hover:underline"
          >
            <strong className="font-semibold text-foreground">
              {followingCount}
            </strong>{" "}
            <span className="text-muted-foreground">Following</span>
          </Link>
          <Link
            href={`/profile/${profileIdentifier}/followers`}
            className="hover:underline"
          >
            <strong className="font-semibold text-foreground">
              {followerCount}
            </strong>{" "}
            <span className="text-muted-foreground">Followers</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
