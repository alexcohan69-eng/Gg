"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { followUser, unfollowUser } from "@/app/actions/follows"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Optimistic follow/unfollow toggle, mirroring the like/repost/bookmark
 * pattern in `PostCard`: flip local state immediately, revert with a
 * toast if the server action fails. Used on profile pages and in
 * follower/following list rows.
 */
export function FollowButton({
  targetUserId,
  initialIsFollowing,
  /** The username or id currently shown in the URL, for targeted revalidation. */
  profileIdentifier,
  size = "sm",
  className,
}: {
  targetUserId: string
  initialIsFollowing: boolean
  profileIdentifier?: string
  size?: "sm" | "default"
  className?: string
}) {
  const router = useRouter()
  const [following, setFollowing] = useState(initialIsFollowing)
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    const next = !following
    setFollowing(next)

    startTransition(async () => {
      const result = next
        ? await followUser(targetUserId, profileIdentifier)
        : await unfollowUser(targetUserId, profileIdentifier)

      if (!result.success) {
        setFollowing(!next)
        toast.error(result.error ?? "Something went wrong.")
        return
      }

      router.refresh()
    })
  }

  return (
    <Button
      type="button"
      variant={following ? "outline" : "default"}
      size={size}
      aria-pressed={following}
      disabled={isPending}
      onClick={handleClick}
      className={cn("min-w-24 rounded-full", className)}
    >
      {following ? "Following" : "Follow"}
    </Button>
  )
}
