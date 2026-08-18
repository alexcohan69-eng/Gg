import { and, desc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { follows, user } from "@/lib/db/schema"

/**
 * Public profile fields shared by the self profile page, public profile
 * page, and follower/following list rows. Deliberately excludes
 * anything auth-only (email, etc.) since this is read by pages that
 * render other people's data, not just the viewer's own session.
 */
export type ProfileUser = {
  id: string
  name: string
  username: string | null
  bio: string | null
  image: string | null
  bannerImage: string | null
  website: string | null
  location: string | null
  createdAt: Date
}

const profileSelection = {
  id: user.id,
  name: user.name,
  username: user.username,
  bio: user.bio,
  image: user.image,
  bannerImage: user.bannerImage,
  website: user.website,
  location: user.location,
  createdAt: user.createdAt,
} as const

/**
 * Looks a profile up by username first — the canonical public
 * identifier used in profile URLs — falling back to the raw user id.
 * Username is optional at sign-up, so posts authored before a user
 * sets one still need a working profile link; those links use the id.
 */
export async function getProfileByIdentifier(
  identifier: string,
): Promise<ProfileUser | null> {
  const byUsername = await db
    .select(profileSelection)
    .from(user)
    .where(eq(user.username, identifier))
    .limit(1)

  if (byUsername[0]) return byUsername[0]

  const byId = await db
    .select(profileSelection)
    .from(user)
    .where(eq(user.id, identifier))
    .limit(1)

  return byId[0] ?? null
}

export async function getFollowCounts(userId: string) {
  const [followerRows, followingRows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.followingId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.followerId, userId)),
  ])

  return {
    followers: followerRows[0]?.count ?? 0,
    following: followingRows[0]?.count ?? 0,
  }
}

/** Whether `viewerId` currently follows `targetId`. Always false for self. */
export async function isFollowing(viewerId: string, targetId: string) {
  if (viewerId === targetId) return false

  const rows = await db
    .select({ id: follows.id })
    .from(follows)
    .where(
      and(eq(follows.followerId, viewerId), eq(follows.followingId, targetId)),
    )
    .limit(1)

  return rows.length > 0
}

async function getViewerFollowingSet(viewerId: string): Promise<Set<string>> {
  const rows = await db
    .select({ followingId: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, viewerId))

  return new Set(rows.map((row) => row.followingId))
}

export type FollowListUser = ProfileUser & {
  /** Whether the viewer (not the profile owner) follows this user. */
  isFollowedByViewer: boolean
  /** Whether this row is the viewer's own account. */
  isSelf: boolean
}

/** Users who follow `userId`, most recent follow first. */
export async function getFollowers(
  userId: string,
  viewerId: string,
): Promise<FollowListUser[]> {
  const [rows, viewerFollowing] = await Promise.all([
    db
      .select(profileSelection)
      .from(follows)
      .innerJoin(user, eq(follows.followerId, user.id))
      .where(eq(follows.followingId, userId))
      .orderBy(desc(follows.createdAt)),
    getViewerFollowingSet(viewerId),
  ])

  return rows.map((row) => ({
    ...row,
    isFollowedByViewer: viewerFollowing.has(row.id),
    isSelf: row.id === viewerId,
  }))
}

/** Users `userId` follows, most recent follow first. */
export async function getFollowing(
  userId: string,
  viewerId: string,
): Promise<FollowListUser[]> {
  const [rows, viewerFollowing] = await Promise.all([
    db
      .select(profileSelection)
      .from(follows)
      .innerJoin(user, eq(follows.followingId, user.id))
      .where(eq(follows.followerId, userId))
      .orderBy(desc(follows.createdAt)),
    getViewerFollowingSet(viewerId),
  ])

  return rows.map((row) => ({
    ...row,
    isFollowedByViewer: viewerFollowing.has(row.id),
    isSelf: row.id === viewerId,
  }))
}
