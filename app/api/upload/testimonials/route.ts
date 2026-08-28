import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { headers } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { getSessionWithRetry } from "@/lib/auth"
import { logActionError } from "@/lib/log-action-error"
import { ALLOWED_PROFILE_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from "@/lib/media"

/**
 * Issues a Vercel Blob client-upload token for a testimonial's author
 * avatar — a stills-only image (no video), same rules as the profile
 * avatar upload. See /api/upload/profile-image for the full
 * rationale on uploading straight from the browser to Blob storage
 * instead of proxying through this function.
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
          // fall through to the invalid-mime check below
        }
        if (!(ALLOWED_PROFILE_IMAGE_TYPES as readonly string[]).includes(mime)) {
          throw new Error("Only JPEG, PNG, WebP, and GIF images are supported.")
        }

        return {
          allowedContentTypes: [mime],
          maximumSizeInBytes: MAX_IMAGE_SIZE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: session.user.id, kind: "avatar" }),
        }
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    logActionError("uploadTestimonialImage", error, { userId: session.user.id })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed. Please try again." },
      { status: 400 },
    )
  }
}
