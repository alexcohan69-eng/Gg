/**
 * Static content backing the /developers docs page. Kept as data
 * (rather than hardcoded JSX) so the endpoint list stays easy to scan
 * against backendApi.md and to keep in sync as routes change.
 */

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE"

export interface EndpointDoc {
  method: HttpMethod
  path: string
  auth: "none" | "optional" | "required"
  description: string
  params?: string
  requestExample?: string
  responseExample: string
}

export interface EndpointGroup {
  id: string
  title: string
  description: string
  endpoints: EndpointDoc[]
}

const userSummaryExample = `{
  "id": "usr_9f3c",
  "username": "amelia",
  "name": "Amelia Chen",
  "bio": "Product designer. Building in public.",
  "avatarUrl": "https://...",
  "location": "Lisbon, Portugal",
  "website": "https://amelia.design",
  "followerCount": 1204,
  "followingCount": 312,
  "createdAt": "2025-01-04T12:00:00.000Z"
}`

const postExample = `{
  "id": "pst_7a1e",
  "author": { "username": "amelia", "name": "Amelia Chen", "avatarUrl": "https://..." },
  "content": "<p>Shipping the new onboarding flow today.</p>",
  "createdAt": "2026-08-30T09:12:00.000Z",
  "likeCount": 42,
  "repostCount": 3,
  "replyCount": 5,
  "likedByViewer": false,
  "repostedByViewer": false,
  "bookmarkedByViewer": false
}`

export const API_GROUPS: EndpointGroup[] = [
  {
    id: "users",
    title: "Users",
    description: "Public profile data, follower graphs, and a user's showcase content — no key required.",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/users/:username",
        auth: "optional",
        description:
          "Fetch a public profile by username. Pass a key to also get viewer-specific fields like followedByViewer.",
        responseExample: `{ "data": ${userSummaryExample} }`,
      },
      {
        method: "GET",
        path: "/api/v1/users/:username/posts",
        auth: "optional",
        params: "?cursor, ?limit (max 50)",
        description: "A user's posts, newest first, cursor-paginated.",
        responseExample: `{ "data": { "posts": [${postExample}], "nextCursor": "pst_6b2d" } }`,
      },
      {
        method: "GET",
        path: "/api/v1/users/:username/followers",
        auth: "optional",
        params: "?cursor, ?limit (max 50)",
        description: "Accounts following this user.",
        responseExample: `{ "data": { "users": [${userSummaryExample}], "nextCursor": null } }`,
      },
      {
        method: "GET",
        path: "/api/v1/users/:username/following",
        auth: "optional",
        params: "?cursor, ?limit (max 50)",
        description: "Accounts this user follows.",
        responseExample: `{ "data": { "users": [${userSummaryExample}], "nextCursor": null } }`,
      },
      {
        method: "GET",
        path: "/api/v1/users/:username/services",
        auth: "none",
        description: "A user's published service listings (their Services tab).",
        responseExample: `{ "data": { "services": [{ "id": "svc_1a", "title": "Brand identity design", "priceCents": 250000, "description": "..." }] } }`,
      },
      {
        method: "GET",
        path: "/api/v1/users/:username/portfolio",
        auth: "none",
        description: "A user's published case studies (their Work tab).",
        responseExample: `{ "data": { "projects": [{ "id": "prj_1a", "title": "Nomad Rebrand", "summary": "..." }] } }`,
      },
      {
        method: "GET",
        path: "/api/v1/users/:username/testimonials",
        auth: "none",
        description: "A user's published testimonials.",
        responseExample: `{ "data": { "testimonials": [{ "id": "tst_1a", "quote": "...", "authorName": "..." }] } }`,
      },
      {
        method: "POST",
        path: "/api/v1/users/:username/follow",
        auth: "required",
        description: "Follow this user as your key's owner.",
        requestExample: `curl -X POST https://pulse.app/api/v1/users/amelia/follow \\
  -H "Authorization: Bearer pk_live_..."`,
        responseExample: `{ "data": { "success": true } }`,
      },
      {
        method: "DELETE",
        path: "/api/v1/users/:username/follow",
        auth: "required",
        description: "Unfollow this user as your key's owner.",
        responseExample: `{ "data": { "success": true } }`,
      },
    ],
  },
  {
    id: "posts",
    title: "Posts",
    description: "The public feed, individual posts, and creating/removing your own posts.",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/posts",
        auth: "optional",
        params: "?sort=recent, ?cursor, ?limit (max 50)",
        description: "The public feed.",
        responseExample: `{ "data": { "posts": [${postExample}], "nextCursor": "pst_6b2d" } }`,
      },
      {
        method: "GET",
        path: "/api/v1/posts/:id",
        auth: "optional",
        description: "A single post and its replies.",
        responseExample: `{ "data": { "post": ${postExample}, "replies": [] } }`,
      },
      {
        method: "POST",
        path: "/api/v1/posts",
        auth: "required",
        params: "form field: content (HTML)",
        description: "Create a post as your key's owner. Same content rules as the web composer.",
        requestExample: `curl -X POST https://pulse.app/api/v1/posts \\
  -H "Authorization: Bearer pk_live_..." \\
  -F "content=<p>Hello from my bot</p>"`,
        responseExample: `{ "data": { "post": ${postExample} } }`,
      },
      {
        method: "DELETE",
        path: "/api/v1/posts/:id",
        auth: "required",
        description: "Delete a post you own.",
        responseExample: `{ "data": { "success": true } }`,
      },
      {
        method: "POST",
        path: "/api/v1/posts/:id/like",
        auth: "required",
        description: "Like a post as your key's owner.",
        responseExample: `{ "data": { "success": true } }`,
      },
      {
        method: "DELETE",
        path: "/api/v1/posts/:id/like",
        auth: "required",
        description: "Unlike a post.",
        responseExample: `{ "data": { "success": true } }`,
      },
      {
        method: "POST",
        path: "/api/v1/posts/:id/repost",
        auth: "required",
        description: "Repost a post as your key's owner.",
        responseExample: `{ "data": { "success": true } }`,
      },
      {
        method: "DELETE",
        path: "/api/v1/posts/:id/repost",
        auth: "required",
        description: "Undo a repost.",
        responseExample: `{ "data": { "success": true } }`,
      },
      {
        method: "POST",
        path: "/api/v1/posts/:id/bookmark",
        auth: "required",
        description: "Bookmark a post as your key's owner.",
        responseExample: `{ "data": { "success": true } }`,
      },
      {
        method: "DELETE",
        path: "/api/v1/posts/:id/bookmark",
        auth: "required",
        description: "Remove a bookmark.",
        responseExample: `{ "data": { "success": true } }`,
      },
    ],
  },
  {
    id: "search",
    title: "Search",
    description: "Full-text search across posts and users.",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/search",
        auth: "optional",
        params: "?q (required), ?limit (max 50)",
        description: "Search posts and users matching a query.",
        responseExample: `{ "data": { "posts": [${postExample}], "users": [${userSummaryExample}] } }`,
      },
    ],
  },
  {
    id: "me",
    title: "Your account",
    description: "Endpoints scoped to your key's own account — always require a valid key.",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/me",
        auth: "required",
        description: "Your own profile.",
        responseExample: `{ "data": ${userSummaryExample} }`,
      },
      {
        method: "PATCH",
        path: "/api/v1/me",
        auth: "required",
        params: "form fields: name, username, bio, website, location",
        description: "Update your profile. Same validation as the web settings form.",
        requestExample: `curl -X PATCH https://pulse.app/api/v1/me \\
  -H "Authorization: Bearer pk_live_..." \\
  -F "bio=Building things in public"`,
        responseExample: `{ "data": { "success": true } }`,
      },
      {
        method: "GET",
        path: "/api/v1/me/bookmarks",
        auth: "required",
        params: "?cursor, ?limit (max 50)",
        description: "Posts you've bookmarked.",
        responseExample: `{ "data": { "posts": [${postExample}], "nextCursor": null } }`,
      },
      {
        method: "GET",
        path: "/api/v1/me/notifications",
        auth: "required",
        params: "?cursor, ?limit (max 50)",
        description: "Your notification feed.",
        responseExample: `{ "data": { "notifications": [{ "id": "ntf_1a", "type": "like", "createdAt": "..." }], "nextCursor": null } }`,
      },
    ],
  },
  {
    id: "services",
    title: "Services",
    description: "CRUD for your own Services tab listings.",
    endpoints: [
      {
        method: "POST",
        path: "/api/v1/services",
        auth: "required",
        description: "Add a new service listing.",
        responseExample: `{ "data": { "service": { "id": "svc_1a" } } }`,
      },
      {
        method: "PATCH",
        path: "/api/v1/services/:id",
        auth: "required",
        description: "Edit a service listing you own.",
        responseExample: `{ "data": { "success": true } }`,
      },
      {
        method: "DELETE",
        path: "/api/v1/services/:id",
        auth: "required",
        description: "Remove a service listing you own.",
        responseExample: `{ "data": { "success": true } }`,
      },
    ],
  },
  {
    id: "portfolio",
    title: "Portfolio",
    description: "CRUD for your own Work tab case studies.",
    endpoints: [
      {
        method: "POST",
        path: "/api/v1/portfolio",
        auth: "required",
        description: "Add a new case study.",
        responseExample: `{ "data": { "project": { "id": "prj_1a" } } }`,
      },
      {
        method: "PATCH",
        path: "/api/v1/portfolio/:id",
        auth: "required",
        description: "Edit a case study you own.",
        responseExample: `{ "data": { "success": true } }`,
      },
      {
        method: "DELETE",
        path: "/api/v1/portfolio/:id",
        auth: "required",
        description: "Remove a case study you own.",
        responseExample: `{ "data": { "success": true } }`,
      },
    ],
  },
  {
    id: "testimonials",
    title: "Testimonials",
    description: "CRUD for your own testimonials.",
    endpoints: [
      {
        method: "POST",
        path: "/api/v1/testimonials",
        auth: "required",
        description: "Add a new testimonial.",
        responseExample: `{ "data": { "testimonial": { "id": "tst_1a" } } }`,
      },
      {
        method: "PATCH",
        path: "/api/v1/testimonials/:id",
        auth: "required",
        description: "Edit a testimonial you own.",
        responseExample: `{ "data": { "success": true } }`,
      },
      {
        method: "DELETE",
        path: "/api/v1/testimonials/:id",
        auth: "required",
        description: "Remove a testimonial you own.",
        responseExample: `{ "data": { "success": true } }`,
      },
    ],
  },
]

export const ERROR_EXAMPLE = `{
  "error": {
    "code": "not_found",
    "message": "No post found for id \\"pst_bad\\"."
  }
}`
