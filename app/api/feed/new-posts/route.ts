import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { getSessionWithRetry } from "@/lib/auth"
import { getBlockedUserIds } from "@/lib/blocks"
import { logActionError } from "@/lib/log-action-error"
import { getNewPostsCount } from "@/lib/posts"

/**
 * Polled by `NewPostsBanner` to check whether posts newer than the
 * viewer's currently rendered feed exist, for the given home tab. A
 * cheap count query — never runs a real feed query — so the "Show N
 * new posts" pill can poll frequently without the cost of refetching
 * full post rows the viewer hasn't asked to see yet.
 */
export async function GET(request: Request) {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const tab = searchParams.get("tab") === "following" ? "following" : "for-you"
  const sinceParam = searchParams.get("since")
  const since = sinceParam ? new Date(sinceParam) : null

  if (!since || Number.isNaN(since.getTime())) {
    return NextResponse.json({ error: "Invalid 'since' parameter." }, { status: 400 })
  }

  try {
    const blockedUserIds = await getBlockedUserIds(session.user.id)
    const newCount = await getNewPostsCount(session.user.id, tab, since, blockedUserIds)
    return NextResponse.json({ count: newCount })
  } catch (error) {
    logActionError("getNewPostsCount", error, { userId: session.user.id, tab })
    return NextResponse.json({ error: "Couldn't check for new posts." }, { status: 500 })
  }
}
