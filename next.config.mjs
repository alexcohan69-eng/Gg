/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000",
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            // Report-only for now: Next.js hydration relies on inline
            // scripts, so an enforcing script-src would need a nonce
            // first. This still surfaces violations in the console
            // without risking breakage. App data (posts, media, auth)
            // is same-origin, so connect-src is otherwise scoped to
            // 'self' plus the few third-party origins below.
            // The portfolio video picker loads the ffmpeg.wasm core
            // from jsdelivr (to strip audio/compress videos client-
            // side before upload) and runs it in a worker, hence
            // connect-src's cdn.jsdelivr.net, script-src's
            // 'wasm-unsafe-eval', and worker-src's blob:. Media
            // uploads (post attachments, avatars/banners, portfolio
            // cover/gallery/description images) go straight from the
            // browser to Vercel Blob storage rather than through our
            // own functions — see /api/upload's comment — hence
            // connect-src's *.public.blob.vercel-storage.com.
            key: "Content-Security-Policy-Report-Only",
            value:
              "default-src 'self'; img-src 'self' data: blob: https://vercel.live https://vercel.com https://*.vercel.com; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://vercel.live https://cdn.jsdelivr.net; worker-src 'self' blob:; connect-src 'self' https://vercel.live https://cdn.jsdelivr.net https://*.public.blob.vercel-storage.com wss://*.pusher.com; frame-src https://vercel.live; font-src 'self' data:; base-uri 'self'; form-action 'self'; frame-ancestors 'self'",
          },
        ],
      },
    ]
  },
}

export default nextConfig
