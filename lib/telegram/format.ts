import type { TelegramInlineKeyboardButton } from "@/lib/telegram/client"
import { getSiteUrl } from "@/lib/env"
import type { FeedPost } from "@/lib/posts"
import { stripHtmlToText } from "@/lib/sanitize-html"

/**
 * Formatting + rich-text layer for the Telegram bot (see usertgbot.md).
 * Two responsibilities live here:
 *
 * 1. Rendering outgoing chat messages as Telegram HTML (parse_mode:
 *    "HTML") with a consistent, modern look — bold labels, section
 *    emoji, monospace ids — instead of the plain-text lines the
 *    dispatcher used to send.
 * 2. Converting a Telegram message's `entities` (the bold/italic/
 *    code/link spans a user applies with the client's own formatting
 *    toolbar) into the same sanitized rich-text HTML the web
 *    composer produces, so a post made from Telegram carries its
 *    formatting onto the site instead of arriving as flat text.
 */

export type TelegramMessageEntity = {
  type: string
  offset: number
  length: number
  url?: string
}

/** Escapes text for safe use inside a Telegram HTML (`parse_mode: "HTML"`) message. */
export function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/** Same as {@link esc}, additionally safe to place inside a double-quoted `href="..."`. */
function escAttr(value: string): string {
  return esc(value).replace(/"/g, "&quot;")
}

export const b = (s: string) => `<b>${esc(s)}</b>`
export const i = (s: string) => `<i>${esc(s)}</i>`
export const code = (s: string) => `<code>${esc(s)}</code>`
export const link = (text: string, url: string) => `<a href="${escAttr(url)}">${esc(text)}</a>`

const SIMPLE_ENTITY_TAG: Record<string, { open: string; close: string }> = {
  bold: { open: "<strong>", close: "</strong>" },
  italic: { open: "<em>", close: "</em>" },
  underline: { open: "<u>", close: "</u>" },
  strikethrough: { open: "<s>", close: "</s>" },
  code: { open: "<code>", close: "</code>" },
  pre: { open: "<pre>", close: "</pre>" },
  blockquote: { open: "<blockquote>", close: "</blockquote>" },
  expandable_blockquote: { open: "<blockquote>", close: "</blockquote>" },
}

/**
 * Converts Telegram message text + its `entities` array into the same
 * rich-text HTML shape the web composer produces (`<strong>`,
 * `<em>`, `<u>`, `<s>`, `<code>`, `<pre>`, `<blockquote>`, `<a>`,
 * `<p>`/`<br>`) so `sanitizePostHtml` accepts it and the post renders
 * on the site with identical formatting to what was typed in Telegram.
 *
 * Telegram entity `offset`/`length` are UTF-16 code unit counts —
 * exactly how JS strings already index — so no surrogate-pair
 * handling is needed; plain `string.slice` lines up directly.
 *
 * Unsupported entity types (mentions, hashtags, spoilers, custom
 * emoji, ...) are left as plain escaped text rather than dropped,
 * since the underlying characters are still meaningful content.
 */
export function telegramTextToPostHtml(text: string, entities: TelegramMessageEntity[] = []): string {
  type Tagged = TelegramMessageEntity & { tagUrl?: string }

  const tagged: Tagged[] = entities
    .filter((e) => e.length > 0 && e.offset >= 0 && e.offset + e.length <= text.length)
    .map((e) => {
      if (e.type === "text_link" && e.url) return { ...e, tagUrl: e.url }
      if (e.type === "url") return { ...e, tagUrl: text.slice(e.offset, e.offset + e.length) }
      if (SIMPLE_ENTITY_TAG[e.type]) return e
      return null
    })
    .filter((e): e is Tagged => e !== null)

  type Ev = { pos: number; kind: "open" | "close"; length: number; entity: Tagged }
  const events: Ev[] = []
  for (const e of tagged) {
    events.push({ pos: e.offset, kind: "open", length: e.length, entity: e })
    events.push({ pos: e.offset + e.length, kind: "close", length: e.length, entity: e })
  }
  // Closes before opens at the same position; among opens the longer
  // (outer) span opens first, among closes the shorter (inner) span
  // closes first — Telegram guarantees entities nest cleanly rather
  // than partially overlapping, so this always yields valid markup.
  events.sort((a, b2) => {
    if (a.pos !== b2.pos) return a.pos - b2.pos
    if (a.kind !== b2.kind) return a.kind === "close" ? -1 : 1
    return a.kind === "open" ? b2.length - a.length : a.length - b2.length
  })

  function tagFor(e: Tagged, kind: "open" | "close"): string {
    if (e.type === "text_link" || e.type === "url") {
      return kind === "open" ? `<a href="${escAttr(e.tagUrl!)}">` : "</a>"
    }
    return SIMPLE_ENTITY_TAG[e.type][kind]
  }

  let inlineHtml = ""
  let cursor = 0
  for (const ev of events) {
    if (ev.pos > cursor) {
      inlineHtml += esc(text.slice(cursor, ev.pos))
      cursor = ev.pos
    }
    inlineHtml += tagFor(ev.entity, ev.kind)
  }
  if (cursor < text.length) {
    inlineHtml += esc(text.slice(cursor))
  }

  // Newlines only ever appear as literal characters in the escaped
  // text runs above (never inside the synthetic tags this function
  // emits), so splitting on them here can't land inside a tag.
  const paragraphs = inlineHtml
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  if (paragraphs.length === 0) return ""
  return paragraphs.map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("")
}

/** Absolute site URL for a post's permalink. */
export function postUrl(postId: string): string {
  return `${getSiteUrl()}/post/${postId}`
}

/** Absolute site URL for a profile. Falls back to the raw id when no username is set. */
export function profileUrl(profile: { id: string; username?: string | null }): string {
  return `${getSiteUrl()}/profile/${profile.username ?? profile.id}`
}

const RELATIVE_TIME_UNITS: [number, string][] = [
  [60, "s"],
  [60, "m"],
  [24, "h"],
  [7, "d"],
  [4.345, "w"],
  [12, "mo"],
  [Number.POSITIVE_INFINITY, "y"],
]

/** Short relative time (e.g. "5m", "3h", "2d") for compact card headers. */
export function relativeTime(date: Date): string {
  let diff = Math.max(0, (Date.now() - date.getTime()) / 1000)
  for (const [amount, unit] of RELATIVE_TIME_UNITS) {
    if (diff < amount || amount === Number.POSITIVE_INFINITY) {
      return `${Math.max(1, Math.floor(diff))}${unit}`
    }
    diff /= amount
  }
  return "now"
}

function truncate(text: string, length: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= length) return trimmed || "(no text)"
  return `${trimmed.slice(0, length)}…`
}

export type PostCardOptions = {
  /** Show engagement action buttons (like/repost/bookmark). Off for e.g. reply previews. */
  actions?: boolean
  /** Show a "View thread" button that dispatches /view. */
  viewButton?: boolean
}

/** One post rendered as a Telegram HTML card + its inline action row. */
export function formatPostCard(
  post: FeedPost,
  opts: PostCardOptions = {},
): { text: string; keyboard: TelegramInlineKeyboardButton[][] } {
  const author = post.authorUsername ? `@${post.authorUsername}` : post.authorName
  const text = [
    `👤 ${b(author)} · ${esc(relativeTime(post.createdAt))}`,
    esc(truncate(stripHtmlToText(post.content), 500)),
    `❤️ ${post.likeCount}   💬 ${post.replyCount}   🔁 ${post.repostCount}`,
    `🆔 ${code(post.id)}`,
  ].join("\n\n")

  const keyboard: TelegramInlineKeyboardButton[][] = []
  if (opts.actions !== false) {
    keyboard.push([
      { text: post.isLiked ? "💔 Unlike" : "❤️ Like", callback_data: `act:${post.isLiked ? "unlike" : "like"}:${post.id}` },
      {
        text: post.isReposted ? "↩️ Undo repost" : "🔁 Repost",
        callback_data: `act:${post.isReposted ? "unrepost" : "repost"}:${post.id}`,
      },
    ])
    keyboard.push([
      {
        text: post.isBookmarked ? "🔖 Unsave" : "🔖 Save",
        callback_data: `act:${post.isBookmarked ? "unbookmark" : "bookmark"}:${post.id}`,
      },
      ...(opts.viewButton !== false ? [{ text: "💬 View thread", callback_data: `view:${post.id}` }] : []),
    ])
  }
  keyboard.push([{ text: "🌐 Open on site", url: postUrl(post.id) }])

  return { text, keyboard }
}

/** Main menu inline keyboard shown on /start and /help, and re-sent by the "🏠 Menu" button. */
export function mainMenuKeyboard(): TelegramInlineKeyboardButton[][] {
  return [
    [
      { text: "📰 Feed", callback_data: "menu:feed" },
      { text: "👤 My Profile", callback_data: "menu:me" },
    ],
    [
      { text: "🔔 Notifications", callback_data: "menu:notifications" },
      { text: "✉️ Inbox", callback_data: "menu:inbox" },
    ],
    [
      { text: "✍️ New Post", callback_data: "compose:post" },
      { text: "📖 All Commands", callback_data: "menu:help" },
    ],
  ]
}
