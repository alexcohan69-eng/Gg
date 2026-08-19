import type { MetadataRoute } from "next"

/**
 * Only the public landing and auth pages are worth indexing — the rest
 * of the app is behind authentication and personal to each viewer, so
 * we keep those routes and the API out of search results.
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
        "/messages",
        "/bookmarks",
        "/settings",
        "/profile",
        "/post",
        "/api/",
      ],
    },
  }
}
