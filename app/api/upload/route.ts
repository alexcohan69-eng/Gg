import { put } from "@vercel/blob"
import { headers } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { validateImageFile } from "@/lib/media"

/**
 * Uploads a single image to Vercel Blob for use as a post attachment.
 * Requires an authenticated session — this is the server-side gate
 * that stops unauthenticated or unauthorized callers from writing to
 * blob storage, since anyone can hit this route's URL directly.
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
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
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 })
  }

  const validationError = validateImageFile(file)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  try {
    const blob = await put(`posts/${session.user.id}/${file.name}`, file, {
      access: "private",
      addRandomSuffix: true,
    })

    // The store is private, so `blob.url` isn't publicly fetchable. We
    // persist and render images through `/api/media`, which streams the
    // file after checking for an authenticated session.
    return NextResponse.json({
      url: `/api/media?pathname=${encodeURIComponent(blob.pathname)}`,
    })
  } catch (error) {
    console.error("[v0] Blob upload failed:", error)
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 },
    )
  }
}
