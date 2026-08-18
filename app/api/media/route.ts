import { headers } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import { get } from "@vercel/blob"
import { auth } from "@/lib/auth"

/**
 * Streams a privately-stored post image to any authenticated user.
 * Post images are viewable by anyone who can see the post (this is a
 * public feed), so the only check here is "is there a session at
 * all" — not ownership. Mutating actions (uploading, deleting) are
 * the ones scoped to the owning user, in /api/upload and the post
 * delete action.
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const pathname = request.nextUrl.searchParams.get("pathname")
  if (!pathname || !pathname.startsWith("posts/")) {
    return NextResponse.json({ error: "Invalid pathname" }, { status: 400 })
  }

  try {
    const result = await get(pathname, {
      access: "private",
      ifNoneMatch: request.headers.get("if-none-match") ?? undefined,
    })

    if (!result) {
      return new NextResponse("Not found", { status: 404 })
    }

    if (result.statusCode === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: result.blob.etag,
          "Cache-Control": "private, no-cache",
        },
      })
    }

    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType,
        ETag: result.blob.etag,
        "Cache-Control": "private, no-cache",
      },
    })
  } catch (error) {
    console.error("[v0] Failed to serve media:", error)
    return NextResponse.json({ error: "Failed to load image" }, { status: 500 })
  }
}
