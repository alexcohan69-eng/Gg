import { put } from "@vercel/blob"
import { headers } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { getSessionWithRetry } from "@/lib/auth"
import { logActionError } from "@/lib/log-action-error"
import { validateProfileImageFile } from "@/lib/media"

/**
 * Uploads a portfolio case-study cover or gallery image, using the
 * same private-store + proxy pattern as post attachments and profile
 * images (see /api/upload and /api/upload/profile-image): `put()` uses
 * `access: "private"`, and the returned URL points at /api/media
 * rather than a raw blob URL.
 */
export async function POST(request: NextRequest) {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 })
  }

  const file = formData.get("file")
  const kind = formData.get("kind")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 })
  }
  if (kind !== "cover" && kind !== "gallery") {
    return NextResponse.json({ error: "Invalid image kind." }, { status: 400 })
  }

  const validationError = validateProfileImageFile(file)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  try {
    const blob = await put(
      `portfolio/${session.user.id}/${kind}-${file.name}`,
      file,
      { access: "private", addRandomSuffix: true },
    )

    return NextResponse.json({
      url: `/api/media?pathname=${encodeURIComponent(blob.pathname)}`,
    })
  } catch (error) {
    logActionError("uploadPortfolioImage", error, {
      userId: session.user.id,
      kind,
    })
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 },
    )
  }
}
