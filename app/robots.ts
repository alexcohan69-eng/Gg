import type { MetadataRoute } from "next"

const siteUrl =
  process.env.BETTER_AUTH_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")

/**
 * Only the landing page is meant to be publicly discoverable — every
 * other route is either an auth form or sits behind a session
 * (feeds, profiles, DMs, settings), and none of that is useful or
 * appropriate as a search result.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/home",
        "/explore",
        "/notifications",
        "/bookmarks",
        "/messages",
        "/messages/*",
        "/profile",
        "/profile/*",
        "/post/*",
        "/settings",
        "/api/*",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
