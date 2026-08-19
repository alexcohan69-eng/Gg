"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { and, eq, or } from "drizzle-orm"
import { getSessionWithRetry } from "@/lib/auth"
import { db } from "@/lib/db"
import { blocks, follows } from "@/lib/db/schema"
import { logActionError } from "@/lib/log-action-error"

async function getUserId() {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

export type BlockActionResult = {
  success: boolean
  error?: string
}

function revalidateBlockPaths(profileIdentifier?: string) {
  revalidatePath("/home")
  revalidatePath("/profile")
  revalidatePath("/explore")
  revalidatePath("/settings/blocked")
  if (profileIdentifier) {
    revalidatePath(`/profile/${profileIdentifier}`)
    revalidatePath(`/profile/${profileIdentifier}/followers`)
    revalidatePath(`/profile/${profileIdentifier}/following`)
  }
}

/**
 * Blocks a user and severs any existing follow edge between the two
 * accounts in both directions — a lingering follow after a block would
 * keep the blocked account's posts showing up in the "Following" feed,
 * which defeats the point of blocking.
 */
export async function blockUser(
  targetUserId: string,
  profileIdentifier?: string,
): Promise<BlockActionResult> {
  try {
    const userId = await getUserId()

    if (userId === targetUserId) {
      return { success: false, error: "You can't block yourself." }
    }

    await db.transaction(async (tx) => {
      await tx
        .insert(blocks)
        .values({ id: crypto.randomUUID(), blockerId: userId, blockedId: targetUserId })
        .onConflictDoNothing()

      await tx
        .delete(follows)
        .where(
          or(
            and(eq(follows.followerId, userId), eq(follows.followingId, targetUserId)),
            and(eq(follows.followerId, targetUserId), eq(follows.followingId, userId)),
          ),
        )
    })

    revalidateBlockPaths(profileIdentifier)
    return { success: true }
  } catch (error) {
    logActionError("blockUser", error, { targetUserId })
    return { success: false, error: "Couldn't block user." }
  }
}

export async function unblockUser(
  targetUserId: string,
  profileIdentifier?: string,
): Promise<BlockActionResult> {
  try {
    const userId = await getUserId()

    await db
      .delete(blocks)
      .where(and(eq(blocks.blockerId, userId), eq(blocks.blockedId, targetUserId)))

    revalidateBlockPaths(profileIdentifier)
    return { success: true }
  } catch (error) {
    logActionError("unblockUser", error, { targetUserId })
    return { success: false, error: "Couldn't unblock user." }
  }
}
