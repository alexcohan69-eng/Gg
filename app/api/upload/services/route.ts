import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { headers } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { getSessionWithRetry } from "@/lib/auth"
import { logActionError } from "@/lib/log-action-error"
import {
  ALLOWED_PROFILE_IMAGE_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  isAllowedMediaType,
  maxSizeForMime,
} from "@/lib/media"

/**
 * Issues a Vercel Blob client-upload token for a service listing's
 * cover, gallery item, or inline description image — same shape as
 * /api/upload/portfolio, just scoped to the "services/" pathname
 * prefix. See that route for the full rationale on why uploads go
 * straight from the browser to Blob storage instead of through this
 * function (large videos exceed a serverless function's request-body
 * cap).
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
        if (kind !== "cover" && kind !== "gallery" && kind !== "description") {
          throw new Error("Invalid image kind.")
        }

        const isDescription = kind === "description"
        const allowed = isDescription
          ? (ALLOWED_PROFILE_IMAGE_TYPES as readonly string[]).includes(mime)
          : isAllowedMediaType(mime)
        if (!allowed) {
          throw new Error(
            isDescription
              ? "Only JPEG, PNG, WebP, and GIF images are supported."
              : "Only JPEG, PNG, WebP, GIF images and MP4, WebM, or MOV videos are supported.",
          )
        }

        return {
          allowedContentTypes: [mime],
          maximumSizeInBytes: isDescription ? MAX_IMAGE_SIZE_BYTES : maxSizeForMime(mime),
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: session.user.id, kind }),
        }
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    logActionError("uploadServiceImage", error, { userId: session.user.id })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed. Please try again." },
      { status: 400 },
    )
  }
}
