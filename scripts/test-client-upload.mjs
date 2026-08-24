// One-off manual verification script for the client-upload flow.
// Exercises the exact production code path: request a client token
// from our route, then PUT bytes directly to Vercel Blob storage with
// that token (never through our own server function). Not part of
// the app — safe to delete after verification.
import { put } from "@vercel/blob/client"

const COOKIE = process.argv[2]
if (!COOKIE) {
  console.error("Usage: node scripts/test-client-upload.mjs '<cookie>'")
  process.exit(1)
}

const sizeMb = 15
const mime = "video/mp4"
const pathname = `portfolio/cover-test-${Date.now()}.mp4`

async function main() {
  const tokenRes = await fetch("http://localhost:3000/api/upload/portfolio", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: COOKIE },
    body: JSON.stringify({
      type: "blob.generate-client-token",
      payload: {
        pathname,
        multipart: false,
        clientPayload: JSON.stringify({ kind: "cover", mime }),
      },
    }),
  })

  const tokenBody = await tokenRes.text()
  console.log("token endpoint status:", tokenRes.status)
  console.log("token endpoint body:", tokenBody.slice(0, 300))
  if (!tokenRes.ok) process.exit(1)

  const { clientToken } = JSON.parse(tokenBody)

  const bytes = new Uint8Array(sizeMb * 1024 * 1024)
  const blob = await put(pathname, bytes, {
    access: "private",
    token: clientToken,
    contentType: mime,
  })

  console.log("upload succeeded:", { pathname: blob.pathname, size: sizeMb + "MB" })

  const mediaUrl = `http://localhost:3000/api/media?pathname=${encodeURIComponent(blob.pathname)}`
  const mediaRes = await fetch(mediaUrl, { headers: { Cookie: COOKIE } })
  console.log("media route status:", mediaRes.status, mediaRes.headers.get("content-type"))
}

main().catch((error) => {
  console.error("FAILED:", error)
  process.exit(1)
})
