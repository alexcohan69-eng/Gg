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
 * Issues a Vercel Blob client-upload token for a portfolio case-study
 * cover, gallery item, or inline description image, then the browser
 * uploads the file straight to Blob storage — never through this
 * function. A server-proxied `put()` (reading the file via
 * `request.formData()`, as this route used to) works fine in local
 * dev but fails real videos/images in production: Vercel's request
 * body cap for Route Handlers sits well under the 20MB video / 5MB
 * image limits this app allows, so large uploads come back as a raw
 * "Request Entity Too Large" response that can't be parsed as JSON.
 *
 * The client reports the file's real mime type in `clientPayload` up
 * front so the issued token is locked to exactly that type and its
 * size cap ("cover"/"gallery" allow image/GIF/video; "description" —
 * inserted inline in the case-study text, never played as a media
 * attachment — is kept to stills only). Vercel Blob independently
 * re-checks both the content type and size against the actual upload
 * bytes, so a client that lies about its mime type just fails the
 * upload rather than bypassing the limit.
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
    logActionError("uploadPortfolioImage", error, { userId: session.user.id })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed. Please try again." },
      { status: 400 },
    )
  }
}
