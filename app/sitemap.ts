import type { MetadataRoute } from "next"

const siteUrl =
  process.env.BETTER_AUTH_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")

/**
 * Every other route either requires a session or is per-user content
 * that isn't meaningful to list statically, so the sitemap only
 * covers the three public, unauthenticated entry points.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: "monthly", priority: 1 },
    { url: `${siteUrl}/sign-in`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/sign-up`, changeFrequency: "yearly", priority: 0.5 },
  ]
}
