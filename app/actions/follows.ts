"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"
import { getSessionWithRetry } from "@/lib/auth"
import { db } from "@/lib/db"
import { follows } from "@/lib/db/schema"
import { createNotification } from "@/lib/notifications"
import { isBlockedEitherWay } from "@/lib/blocks"
import { logActionError } from "@/lib/log-action-error"

async function getUserId() {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

export type FollowActionResult = {
  success: boolean
  error?: string
}

/**
 * Revalidates every page whose data depends on this follow edge: the
 * viewer's own profile (counts change) and, when known, the profile
 * being followed/unfollowed plus its follower/following lists and the
 * home following feed.
 */
function revalidateFollowPaths(profileIdentifier?: string) {
  revalidatePath("/profile")
  revalidatePath("/home")
  if (profileIdentifier) {
    revalidatePath(`/profile/${profileIdentifier}`)
    revalidatePath(`/profile/${profileIdentifier}/followers`)
    revalidatePath(`/profile/${profileIdentifier}/following`)
  }
}

/**
 * Takes `userId` directly instead of resolving it from the request, so
 * both the web app's session-authenticated `followUser` below and the
 * public `/api/v1/users/:username/follow` route (authenticated by API
 * key) share one implementation.
 */
export async function followUserForUser(
  userId: string,
  targetUserId: string,
  profileIdentifier?: string,
): Promise<FollowActionResult> {
  try {
    if (userId === targetUserId) {
      return { success: false, error: "You can't follow yourself." }
    }

    if (await isBlockedEitherWay(userId, targetUserId)) {
      return { success: false, error: "You can't follow this account." }
    }

    const inserted = await db
      .insert(follows)
      .values({
        id: crypto.randomUUID(),
        followerId: userId,
        followingId: targetUserId,
      })
      .onConflictDoNothing()
      .returning({ id: follows.id })

    // Only notify on a newly created follow edge — re-following after
    // already following (a no-op conflict) shouldn't re-notify.
    if (inserted.length > 0) {
      await createNotification({
        recipientId: targetUserId,
        actorId: userId,
        type: "follow",
      })
    }

    revalidateFollowPaths(profileIdentifier)
    return { success: true }
  } catch (error) {
    logActionError("followUser", error, { targetUserId })
    return { success: false, error: "Couldn't follow user." }
  }
}

/** Session-authenticated entry point used by the web app's follow buttons. */
export async function followUser(
  targetUserId: string,
  profileIdentifier?: string,
): Promise<FollowActionResult> {
  const userId = await getUserId()
  return followUserForUser(userId, targetUserId, profileIdentifier)
}

export async function unfollowUserForUser(
  userId: string,
  targetUserId: string,
  profileIdentifier?: string,
): Promise<FollowActionResult> {
  try {
    await db
      .delete(follows)
      .where(
        and(eq(follows.followerId, userId), eq(follows.followingId, targetUserId)),
      )

    revalidateFollowPaths(profileIdentifier)
    return { success: true }
  } catch (error) {
    logActionError("unfollowUser", error, { targetUserId })
    return { success: false, error: "Couldn't unfollow user." }
  }
}

/** Session-authenticated entry point used by the web app's follow buttons. */
export async function unfollowUser(
  targetUserId: string,
  profileIdentifier?: string,
): Promise<FollowActionResult> {
  const userId = await getUserId()
  return unfollowUserForUser(userId, targetUserId, profileIdentifier)
}
