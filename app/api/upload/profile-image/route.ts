import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { headers } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { getSessionWithRetry } from "@/lib/auth"
import { logActionError } from "@/lib/log-action-error"
import { ALLOWED_PROFILE_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from "@/lib/media"

/**
 * Issues a Vercel Blob client-upload token for an avatar or banner
 * image, then the browser uploads the file straight to Blob storage —
 * never through this function. See /api/upload and
 * /api/upload/portfolio for the full rationale: a server-proxied
 * `put()` works in local dev but fails larger uploads in production
 * once they exceed Vercel's Route Handler body cap, returning a raw
 * "Request Entity Too Large" response instead of JSON.
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
        let kind = ""
        let mime = ""
        try {
          const parsed = clientPayload ? JSON.parse(clientPayload) : null
          kind = typeof parsed?.kind === "string" ? parsed.kind : ""
          mime = typeof parsed?.mime === "string" ? parsed.mime : ""
        } catch {
          // fall through to the invalid-kind check below
        }
        if (kind !== "avatar" && kind !== "banner") {
          throw new Error("Invalid image kind.")
        }
        if (!(ALLOWED_PROFILE_IMAGE_TYPES as readonly string[]).includes(mime)) {
          throw new Error("Only JPEG, PNG, WebP, and GIF images are supported.")
        }

        return {
          allowedContentTypes: [mime],
          maximumSizeInBytes: MAX_IMAGE_SIZE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: session.user.id, kind }),
        }
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    logActionError("uploadProfileImage", error, { userId: session.user.id })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed. Please try again." },
      { status: 400 },
    )
  }
}
