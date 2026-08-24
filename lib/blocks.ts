import { and, desc, eq, or } from "drizzle-orm"
import { db } from "@/lib/db"
import { blocks, user } from "@/lib/db/schema"
import type { ProfileUser } from "@/lib/follows"

/**
 * Whether either user has blocked the other. This is the single check
 * every direct-interaction action (follow, message, like, repost,
 * reply) guards with — a block in either direction should stop both
 * sides from acting on each other, not just the blocker.
 */
export async function isBlockedEitherWay(
  userA: string,
  userB: string,
): Promise<boolean> {
  if (userA === userB) return false

  const rows = await db
    .select({ id: blocks.id })
    .from(blocks)
    .where(
      or(
        and(eq(blocks.blockerId, userA), eq(blocks.blockedId, userB)),
        and(eq(blocks.blockerId, userB), eq(blocks.blockedId, userA)),
      ),
    )
    .limit(1)

  return rows.length > 0
}

export type BlockState = {
  /** The viewer has blocked the profile being viewed. */
  viewerBlockedTarget: boolean
  /** The profile being viewed has blocked the viewer. */
  targetBlockedViewer: boolean
}

/** Directional block state between a viewer and a profile they're looking at. */
export async function getBlockState(
  viewerId: string,
  targetId: string,
): Promise<BlockState> {
  if (viewerId === targetId) {
    return { viewerBlockedTarget: false, targetBlockedViewer: false }
  }

  const rows = await db
    .select({ blockerId: blocks.blockerId, blockedId: blocks.blockedId })
    .from(blocks)
    .where(
      or(
        and(eq(blocks.blockerId, viewerId), eq(blocks.blockedId, targetId)),
        and(eq(blocks.blockerId, targetId), eq(blocks.blockedId, viewerId)),
      ),
    )

  return {
    viewerBlockedTarget: rows.some((row) => row.blockerId === viewerId),
    targetBlockedViewer: rows.some((row) => row.blockerId === targetId),
  }
}

/**
 * Every user id blocked in either direction relative to `viewerId` —
 * the set feed/search/discover queries exclude authors against so
 * blocked accounts stop appearing in normal social surfaces.
 */
export async function getBlockedUserIds(viewerId: string): Promise<Set<string>> {
  const rows = await db
    .select({ blockerId: blocks.blockerId, blockedId: blocks.blockedId })
    .from(blocks)
    .where(or(eq(blocks.blockerId, viewerId), eq(blocks.blockedId, viewerId)))

  const ids = new Set<string>()
  for (const row of rows) {
    ids.add(row.blockerId === viewerId ? row.blockedId : row.blockerId)
  }
  return ids
}

export type BlockedUser = ProfileUser

/** Users `viewerId` has blocked, most recently blocked first — for the settings management page. */
export async function getBlockedUsers(viewerId: string): Promise<BlockedUser[]> {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      bio: user.bio,
      about: user.about,
      image: user.image,
      bannerImage: user.bannerImage,
      website: user.website,
      location: user.location,
      createdAt: user.createdAt,
      blockedAt: blocks.createdAt,
    })
    .from(blocks)
    .innerJoin(user, eq(blocks.blockedId, user.id))
    .where(eq(blocks.blockerId, viewerId))
    .orderBy(desc(blocks.createdAt))

  return rows.map(({ blockedAt, ...profile }) => profile)
}
