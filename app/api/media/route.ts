import { headers } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import { get } from "@vercel/blob"
import { getSessionWithRetry } from "@/lib/auth"
import { logActionError } from "@/lib/log-action-error"

/**
 * Streams a privately-stored post attachment or profile image
 * (avatar/banner) to any authenticated user. Both are viewable by
 * anyone who can see the post or profile (this is a public feed), so
 * the only check here is "is there a session at all" — not
 * ownership. Mutating actions (uploading, deleting) are the ones
 * scoped to the owning user, in /api/upload,
 * /api/upload/profile-image, and the post delete action.
 *
 * The incoming `Range` header (used by `<video>` for seeking) is
 * forwarded to the underlying blob fetch, and the response is relayed
 * as a real 206 Partial Content when the origin honors it. This is a
 * best-effort passthrough — @vercel/blob's `get()` doesn't formally
 * type a 206 result, so we detect it from the raw response headers
 * rather than relying on `statusCode`. If the origin doesn't honor the
 * range, we fall back to serving the full file.
 */
export async function GET(request: NextRequest) {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const pathname = request.nextUrl.searchParams.get("pathname")
  if (
    !pathname ||
    !(
      pathname.startsWith("posts/") ||
      pathname.startsWith("profile/") ||
      pathname.startsWith("portfolio/")
    )
  ) {
    return NextResponse.json({ error: "Invalid pathname" }, { status: 400 })
  }

  const range = request.headers.get("range") ?? undefined

  try {
    const result = await get(pathname, {
      access: "private",
      ifNoneMatch: request.headers.get("if-none-match") ?? undefined,
      headers: range ? { Range: range } : undefined,
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

    const contentRange = result.headers.get("content-range")
    const contentLength = result.headers.get("content-length")

    return new NextResponse(result.stream, {
      status: contentRange ? 206 : 200,
      headers: {
        "Content-Type": result.blob.contentType,
        "Accept-Ranges": "bytes",
        ETag: result.blob.etag,
        "Cache-Control": "private, no-cache",
        ...(contentRange ? { "Content-Range": contentRange } : {}),
        ...(contentLength ? { "Content-Length": contentLength } : {}),
      },
    })
  } catch (error) {
    logActionError("serveMedia", error, { userId: session.user.id, pathname })
    return NextResponse.json({ error: "Failed to load media" }, { status: 500 })
  }
}
