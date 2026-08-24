import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { headers } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { getSessionWithRetry } from "@/lib/auth"
import { logActionError } from "@/lib/log-action-error"
import { isAllowedMediaType, maxSizeForMime } from "@/lib/media"

/**
 * Issues a Vercel Blob client-upload token for a post attachment,
 * then the browser uploads the file straight to Blob storage — never
 * through this function. A server-proxied `put()` (reading the file
 * via `request.formData()`, as this route used to) works fine in
 * local dev but fails real videos/large images in production:
 * Vercel's request body cap for Route Handlers sits well under the
 * 20MB video / 5MB image limits this app allows, so large uploads
 * come back as a raw "Request Entity Too Large" response that can't
 * be parsed as JSON.
 *
 * The client reports the file's real mime type in `clientPayload` up
 * front so the issued token is locked to exactly that type and its
 * size cap. Vercel Blob independently re-checks both the content type
 * and size against the actual upload bytes, so a client that lies
 * about its mime type just fails the upload rather than bypassing the
 * limit.
 */
export async function POST(request: NextRequest) {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        let mime = ""
        try {
          const parsed = clientPayload ? JSON.parse(clientPayload) : null
          mime = typeof parsed?.mime === "string" ? parsed.mime : ""
        } catch {
          // fall through to the unsupported-type check below
        }
        if (!isAllowedMediaType(mime)) {
          throw new Error(
            "Only JPEG, PNG, WebP, GIF images and MP4, WebM, or MOV videos are supported.",
          )
        }

        return {
          allowedContentTypes: [mime],
          maximumSizeInBytes: maxSizeForMime(mime),
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: session.user.id }),
        }
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    logActionError("uploadMedia", error, { userId: session.user.id })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed. Please try again." },
      { status: 400 },
    )
  }
}
