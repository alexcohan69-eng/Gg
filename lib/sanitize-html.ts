import sanitizeHtml from "sanitize-html"

/**
 * Tags/attributes allowed in rich-text post content. Kept intentionally
 * small — just enough for the composer's formatting toolbar (bold,
 * italic, strike, links, lists, quote, inline/code block) — so a
 * crafted request can't smuggle in scripts, styles, or arbitrary
 * attributes via the "content" field.
 *
 * Uses the `sanitize-html` package (pure JS, no jsdom) rather than
 * isomorphic-dompurify: jsdom's dependency chain (html-encoding-sniffer
 * -> @exodus/bytes) ships an ESM-only file that Turbopack's serverless
 * bundle can't require(), which crashed every page that touched post
 * content in production.
 */
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "s",
  "u",
  "a",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  // Inline images the portfolio case-study editor can insert into the
  // description body (see components/rich-text-editor.tsx's optional
  // Tiptap Image extension). Harmless to allow globally — an <img> tag
  // can't execute script, and `src` is restricted to http(s)/relative
  // URLs below, same as `href` on links.
  "img",
]

const ALLOWED_ATTR = ["href", "target", "rel"]
const ALLOWED_IMG_ATTR = ["src", "alt"]

/**
 * Sanitizes rich-text HTML produced by the post composer. Used both
 * when storing a new post (createPost is the real security boundary)
 * and again at render time as defense-in-depth before any
 * dangerouslySetInnerHTML call.
 */
export function sanitizePostHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ALLOWED_ATTR,
      img: ALLOWED_IMG_ATTR,
    },
    // `src` on an <img> is restricted the same way `href` on links
    // would be — only http(s) or scheme-relative (e.g. our own
    // /api/media proxy URLs) are allowed, never javascript:/data:.
    allowedSchemesByTag: { img: ["http", "https"] },
    allowProtocolRelative: true,
    // Force safe defaults on links regardless of what the client sent.
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        target: "_blank",
        rel: "noopener noreferrer nofollow ugc",
      }),
    },
  }).trim()
}

/**
 * Strips all markup and collapses whitespace, for contexts that need
 * plain text — metadata excerpts, moderation previews, list snippets.
 */
export function stripHtmlToText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim()
}

/** True when the sanitized content has no visible text and no media-worthy tags (e.g. just "<p></p>"). */
export function isHtmlContentEmpty(html: string): boolean {
  return stripHtmlToText(html).length === 0
}

/**
 * Server-side abuse guard for a post's rich-text content. This is
 * deliberately generous — the composer imposes no user-facing character
 * limit — and exists only to stop a crafted request from storing an
 * unbounded blob. Counted on the plain-text length (via
 * `stripHtmlToText`), not the raw HTML, so formatting markup never eats
 * into the budget.
 */
export const MAX_POST_LENGTH = 10000

/** Plain-text length of sanitized rich-text content, used for the server-side abuse guard. */
export function getPostTextLength(html: string): number {
  return stripHtmlToText(html).length
}
