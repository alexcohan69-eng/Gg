"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { follows } from "@/lib/db/schema"
import { createNotification } from "@/lib/notifications"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
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

export async function followUser(
  targetUserId: string,
  profileIdentifier?: string,
): Promise<FollowActionResult> {
  try {
    const userId = await getUserId()

    if (userId === targetUserId) {
      return { success: false, error: "You can't follow yourself." }
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
  } catch {
    return { success: false, error: "Couldn't follow user." }
  }
}

export async function unfollowUser(
  targetUserId: string,
  profileIdentifier?: string,
): Promise<FollowActionResult> {
  try {
    const userId = await getUserId()

    await db
      .delete(follows)
      .where(
        and(eq(follows.followerId, userId), eq(follows.followingId, targetUserId)),
      )

    revalidateFollowPaths(profileIdentifier)
    return { success: true }
  } catch {
    return { success: false, error: "Couldn't unfollow user." }
  }
}
