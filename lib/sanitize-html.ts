import DOMPurify from "isomorphic-dompurify"

/**
 * Tags/attributes allowed in rich-text post content. Kept intentionally
 * small — just enough for the composer's formatting toolbar (bold,
 * italic, strike, links, lists, quote, inline/code block) — so a
 * crafted request can't smuggle in scripts, styles, or arbitrary
 * attributes via the "content" field.
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
]

const ALLOWED_ATTR = ["href", "target", "rel"]

/**
 * Sanitizes rich-text HTML produced by the post composer. Used both
 * when storing a new post (createPost is the real security boundary)
 * and again at render time as defense-in-depth before any
 * dangerouslySetInnerHTML call.
 */
export function sanitizePostHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  }).trim()
}

/**
 * Strips all markup and collapses whitespace, for contexts that need
 * plain text — metadata excerpts, moderation previews, list snippets.
 */
export function stripHtmlToText(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
    .replace(/\s+/g, " ")
    .trim()
}

/** True when the sanitized content has no visible text and no media-worthy tags (e.g. just "<p></p>"). */
export function isHtmlContentEmpty(html: string): boolean {
  return stripHtmlToText(html).length === 0
}
