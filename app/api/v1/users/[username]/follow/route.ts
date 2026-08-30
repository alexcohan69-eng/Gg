import type { NextRequest } from "next/server"
import { requireApiUser, apiSuccess, withApiErrorHandling } from "@/lib/api-auth"
import { requireProfileByUsername } from "@/lib/api-v1-helpers"
import { followUserForUser, unfollowUserForUser } from "@/app/actions/follows"

/** Follow the user at `:username` as the authenticated API key's owner. Requires a valid API key. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  return withApiErrorHandling(async () => {
    const userId = await requireApiUser(request)
    const { username } = await params
    const target = await requireProfileByUsername(username)
    const result = await followUserForUser(userId, target.id, username)
    return apiSuccess(result)
  })
}

/** Unfollow the user at `:username` as the authenticated API key's owner. Requires a valid API key. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  return withApiErrorHandling(async () => {
    const userId = await requireApiUser(request)
    const { username } = await params
    const target = await requireProfileByUsername(username)
    const result = await unfollowUserForUser(userId, target.id, username)
    return apiSuccess(result)
  })
}
