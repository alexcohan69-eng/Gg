import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { FollowButton } from "@/components/follow-button"
import { getInitials, profileHref } from "@/lib/utils"
import type { FollowListUser } from "@/lib/follows"

/**
 * A single row in a followers/following list: avatar, name, username,
 * optional bio, and a follow action reflecting the viewer's (not the
 * list owner's) relationship to that user. Shared by both the
 * followers and following pages so they stay visually identical.
 */
export function UserListItem({
  user,
  profileIdentifier,
}: {
  user: FollowListUser
  /** The username or id of the profile whose list this row belongs to, for revalidation. */
  profileIdentifier: string
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border p-4">
      <Link href={profileHref(user)} className="shrink-0">
        <Avatar className="size-11">
          <AvatarImage src={user.image ?? undefined} alt={user.name} />
          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
        </Avatar>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link href={profileHref(user)} className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-foreground hover:underline">
            {user.name}
          </span>
          <span className="truncate text-sm text-muted-foreground">
            @{user.username ?? "user"}
          </span>
        </Link>
        {user.bio ? (
          <p className="mt-1 line-clamp-2 text-pretty break-words text-sm leading-relaxed text-foreground">
            {user.bio}
          </p>
        ) : null}
      </div>

      {user.isSelf ? null : (
        <FollowButton
          targetUserId={user.id}
          initialIsFollowing={user.isFollowedByViewer}
          profileIdentifier={profileIdentifier}
          className="mt-0.5 shrink-0"
        />
      )}
    </div>
  )
}
