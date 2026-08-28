import { put } from "@vercel/blob"
import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiError, apiSuccess } from "@/lib/api/response"
import { getMediaTypeForMime, validateMediaFile } from "@/lib/media"

/**
 * POST /api/v1/media — server-side media upload for API consumers.
 * multipart/form-data with a `file` field. Unlike the browser
 * composer's client-token flow (app/api/upload/route.ts, which
 * uploads straight from the browser to Blob to dodge Route Handler
 * body-size limits), this route accepts the file directly in the
 * request body — a reasonable trade-off for a server-to-server API,
 * but keep individual uploads well under the platform's request-body
 * cap for large videos.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return apiError(400, "Request must be multipart/form-data with a 'file' field.")
  }

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return apiError(400, "Missing 'file' field.")
  }

  const validationError = validateMediaFile({ type: file.type, size: file.size })
  if (validationError) return apiError(400, validationError)

  const mediaType = getMediaTypeForMime(file.type)
  const extension = file.name.includes(".") ? file.name.split(".").pop() : undefined
  const pathname = `posts/${auth.userId}/${crypto.randomUUID()}${extension ? `.${extension}` : ""}`

  // Stored privately, same as every other upload path in this app —
  // the returned delivery URL is streamed back out through
  // /api/media, which currently gates on "is there a signed-in
  // browser session" (see app/api/media/route.ts), not the API key.
  // A raw API consumer can attach this URL to a post/listing, but
  // fetching the bytes back still requires a signed-in session, same
  // as any other media in the app today.
  await put(pathname, file, {
    access: "private",
    addRandomSuffix: false,
    contentType: file.type,
  })

  return apiSuccess(
    {
      url: `/api/media?pathname=${encodeURIComponent(pathname)}`,
      type: mediaType,
    },
    201,
  )
}
