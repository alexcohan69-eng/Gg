import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { getProfileByIdentifier, getFollowCounts, getFollowers, getFollowing, isFollowing } from "@/lib/follows"
import {
  getFeedPosts,
  getUserPosts,
  getBookmarkedPosts,
  getPostById,
  getPostReplies,
  type FeedPost,
} from "@/lib/posts"
import { getNotifications } from "@/lib/notifications"
import { searchUsers, searchPosts } from "@/lib/search"
import { getBlockedUserIds } from "@/lib/blocks"
import { getServices, getService } from "@/lib/services"
import { getPortfolioProjects, getPortfolioProject } from "@/lib/portfolio"
import { getTestimonials, getTestimonial } from "@/lib/testimonials"
import { getConversations, getMessages, markConversationRead } from "@/lib/messages"
import { stripHtmlToText } from "@/lib/sanitize-html"
import { createPostForUser, deletePostForUser } from "@/app/actions/posts"
import {
  likePostForUser,
  unlikePostForUser,
  repostPostForUser,
  undoRepostForUser,
  bookmarkPostForUser,
  removeBookmarkForUser,
} from "@/app/actions/interactions"
import { followUserForUser, unfollowUserForUser } from "@/app/actions/follows"
import { deleteServiceForUser } from "@/app/actions/services"
import { deletePortfolioProjectForUser } from "@/app/actions/portfolio"
import { deleteTestimonialForUser } from "@/app/actions/testimonials"
import { startConversationForUser, sendMessageForUser } from "@/app/actions/messages"
import { answerCallbackQuery, editMessageReplyMarkup, resolveOutgoingToken } from "@/lib/telegram/client"
import {
  unlink,
  sendToLink,
  setActiveConversation,
  setComposeMode,
  getSiteUrl,
  confirmVerificationCode,
  type TelegramLink,
} from "@/lib/telegram/links"
import {
  b,
  code,
  esc,
  formatPostCard,
  mainMenuKeyboard,
  postUrl,
  profileUrl,
  telegramTextToPostHtml,
  type TelegramMessageEntity,
} from "@/lib/telegram/format"

/**
 * Full command dispatcher (see usertgbot.md). Every handler here
 * reuses the same app/actions/*.ts / lib/*.ts functions the web app
 * and the public /api/v1 API already use — never a re-implementation
 * — so behavior can never drift between surfaces. `handleUpdate` is
 * the single entry point shared by both webhook routes.
 *
 * Messages are sent with `parse_mode: "HTML"` (see `reply` below) for
 * a legible, modern layout — bold labels, section emoji, monospace
 * ids/commands — so every dynamic value interpolated into a message
 * MUST go through `esc()`/`code()`/`b()` from lib/telegram/format.ts
 * first, or a stray `<`/`&` in user content (a bio, a search query, an
 * error string) will make Telegram reject the whole message.
 */

const LIST_PAGE_SIZE = 10
const PREVIEW_LENGTH = 160

function preview(html: string, length = PREVIEW_LENGTH): string {
  const text = stripHtmlToText(html).trim()
  if (text.length <= length) return text || "(empty)"
  return `${text.slice(0, length)}…`
}

function shortId(id: string): string {
  return id.slice(0, 8)
}

/**
 * Post commands (/like, /view, /delete, ...) need the full post id —
 * unlike services/portfolio/testimonials (bounded to ~30 rows per
 * owner, see `resolveIdPrefix` below), posts span the whole table, so
 * there's no cheap way to resolve a short prefix against every post.
 * List commands print the full id for this reason.
 */
async function resolvePostId(idOrPrefix: string, viewerId: string): Promise<FeedPost | null> {
  return getPostById(idOrPrefix, viewerId)
}

type CommandContext = { link: TelegramLink; userId: string; chatId: string }

async function reply(ctx: CommandContext, text: string, opts?: Parameters<typeof sendToLink>[2]) {
  await sendToLink(ctx.link, text, { parseMode: "HTML", ...opts })
}

async function resolveUser(identifier: string) {
  return getProfileByIdentifier(identifier.replace(/^@/, ""))
}

function usage(example: string, hint?: string): string {
  return [`⚠️ ${b("Usage")}: ${code(example)}`, hint ? esc(hint) : null].filter(Boolean).join("\n")
}

function errorText(prefix: string, error?: string): string {
  return `❌ ${esc(prefix)}${error ? `: ${esc(error)}` : "."}`
}

async function sendPostCard(
  ctx: CommandContext,
  post: FeedPost,
  opts?: Parameters<typeof formatPostCard>[1],
) {
  const { text, keyboard } = formatPostCard(post, opts)
  await reply(ctx, text, { replyMarkup: { inline_keyboard: keyboard } })
}

function buildHelpText(): string {
  return [
    `📖 ${b("Web Banai — every command")}`,
    "",
    `${b("Profile")}`,
    `${code("/me")} — your profile summary`,
    `${code("/profile <username>")} — view a profile`,
    `${code("/bio <text>")} — update your bio`,
    "",
    `${b("Posts")}`,
    `${code("/post <text>")} — publish a post (supports Telegram formatting)`,
    `${code("/delete <postId>")} — delete your post`,
    `${code("/feed")} — latest posts, with tap-to-like/repost/save`,
    `${code("/view <postId>")} — view a post + its replies`,
    "",
    `${b("Engagement")}`,
    `${code("/like")} ${code("/unlike")} ${code("/repost")} ${code("/unrepost")} ${code("/bookmark")} ${code("/unbookmark")} ${code("<postId>")}`,
    `${code("/bookmarks")} — your saved posts`,
    "",
    `${b("Social")}`,
    `${code("/follow")} ${code("/unfollow")} ${code("<username>")}`,
    `${code("/followers")} ${code("/following")} ${code("<username>")}`,
    "",
    `${b("Notifications & search")}`,
    `${code("/notifications")}`,
    `${code("/search <query>")}`,
    "",
    `${b("Services / portfolio / testimonials")}`,
    `${code("/services")} ${code("/portfolio")} ${code("/testimonials")} ${code("[username]")}`,
    `${code("/service")} ${code("/project")} ${code("/testimonial")} ${code("<id>")}`,
    `${code("/delete-service")} ${code("/delete-project")} ${code("/delete-testimonial")} ${code("<id>")}`,
    `${esc("(Creating/editing these is rich content — reply links you to the site.)")}`,
    "",
    `${b("Direct messages")}`,
    `${code("/inbox")} — your conversations`,
    `${code("/dm <username> <message>")} — send a DM`,
    esc("Just type a reply after a DM notification to send it back."),
    "",
    `${b("Account")}`,
    `${code("/whoami")} — which account you're linked as`,
    `${code("/cancel")} — exit compose mode`,
    `${code("/unlink")} — disconnect this bot`,
  ].join("\n")
}

async function sendWelcome(ctx: CommandContext) {
  await reply(
    ctx,
    [
      `👋 ${b("Welcome to Web Banai")}`,
      "",
      "Manage your account right from Telegram — post, engage, browse your feed, and message people, all from this chat.",
      "",
      `Tap ${b("New Post")} below to publish with full formatting, or send ${code("/help")} to see every command.`,
    ].join("\n"),
    { replyMarkup: { inline_keyboard: mainMenuKeyboard() } },
  )
}

export async function handleUpdate(link: TelegramLink, update: Record<string, unknown>): Promise<void> {
  if (!link.verifiedAt) return // hard guarantee — routes already check this too

  const chatId = link.chatId!
  const userId = link.userId
  const ctx: CommandContext = { link, userId, chatId }

  const callbackQuery = update.callback_query as
    | { data?: string; id?: string; message?: { message_id?: number } }
    | undefined
  if (callbackQuery?.data && callbackQuery.id) {
    await handleCallback(ctx, callbackQuery.data, callbackQuery.id, callbackQuery.message?.message_id)
    return
  }

  const message = update.message as { text?: string; entities?: TelegramMessageEntity[] } | undefined
  const rawText = message?.text
  if (!rawText) return
  const text = rawText.trim()
  if (!text) return

  if (!text.startsWith("/")) {
    await handlePlainText(ctx, rawText, message?.entities)
    return
  }

  const [rawCommand, ...rest] = text.split(/\s+/)
  const command = rawCommand.slice(1).split("@")[0].toLowerCase()
  const argLine = text.slice(rawCommand.length).trim()
  const args = rest
  const richArgHtml = buildArgRichHtml(rawText, message?.entities, rawCommand)

  try {
    await dispatch(ctx, command, args, argLine, richArgHtml)
  } catch (error) {
    await reply(ctx, errorText("Something went wrong", error instanceof Error ? error.message : "unknown error"))
  }
}

/**
 * Rebuilds a command's argument text (e.g. everything after `/post `)
 * as rich-text HTML using the *original* message's entities, so
 * formatting applied inline in the same message the command was
 * typed in (`/post **bold** stuff` via Telegram's own formatting
 * toolbar) survives onto the post. Returns null when there's no
 * usable formatting so callers can fall back to plain text.
 */
function buildArgRichHtml(
  rawText: string,
  entities: TelegramMessageEntity[] | undefined,
  rawCommand: string,
): string | null {
  const leadingWs = rawText.length - rawText.trimStart().length
  let argStart = leadingWs + rawCommand.length
  while (argStart < rawText.length && /\s/.test(rawText[argStart])) argStart++
  const argEnd = rawText.trimEnd().length
  if (argStart >= argEnd) return null

  const argText = rawText.slice(argStart, argEnd)
  const relevantEntities = (entities ?? [])
    .map((e) => ({ ...e, offset: e.offset - argStart }))
    .filter((e) => e.offset >= 0 && e.offset + e.length <= argText.length)

  const html = telegramTextToPostHtml(argText, relevantEntities)
  return html || null
}

async function handleCallback(
  ctx: CommandContext,
  data: string,
  callbackQueryId: string,
  messageId: number | undefined,
) {
  const token = resolveOutgoingToken(ctx.link)

  if (data.startsWith("reply:")) {
    const conversationId = data.slice("reply:".length)
    await setActiveConversation(ctx.userId, conversationId)
    await answerCallbackQuery(token, callbackQueryId)
    await reply(ctx, "Type your reply and send it as a normal message.")
    return
  }

  if (data.startsWith("act:")) {
    const [, action, postId] = data.split(":")
    const handler = POST_ACTIONS[action as keyof typeof POST_ACTIONS]
    if (!handler || !postId) {
      await answerCallbackQuery(token, callbackQueryId)
      return
    }
    const result = await handler(ctx.userId, postId)
    await answerCallbackQuery(
      token,
      callbackQueryId,
      result.success ? POST_ACTION_TOAST[action] ?? "Done" : result.error ?? "Couldn't do that.",
    )
    if (result.success && messageId) {
      const post = await resolvePostId(postId, ctx.userId)
      if (post) {
        const { keyboard } = formatPostCard(post)
        await editMessageReplyMarkup(token, ctx.chatId, messageId, { inline_keyboard: keyboard })
      }
    }
    return
  }

  if (data.startsWith("view:")) {
    await answerCallbackQuery(token, callbackQueryId)
    const postId = data.slice("view:".length)
    await dispatch(ctx, "view", [postId], postId, null)
    return
  }

  if (data === "compose:post") {
    await setComposeMode(ctx.userId, "post")
    await answerCallbackQuery(token, callbackQueryId, "Compose mode on")
    await reply(
      ctx,
      [
        `✍️ ${b("New post")}`,
        "",
        "Send your post now as a normal message. Bold, italic, underline, strikethrough, links, and code — anything you format with Telegram's own toolbar — carries over to the site.",
        "",
        `Send ${code("/cancel")} to back out without posting.`,
      ].join("\n"),
    )
    return
  }

  if (data.startsWith("menu:")) {
    await answerCallbackQuery(token, callbackQueryId)
    const target = data.slice("menu:".length)
    if (target === "home") {
      await sendWelcome(ctx)
      return
    }
    if (target === "help") {
      await reply(ctx, buildHelpText(), { replyMarkup: { inline_keyboard: mainMenuKeyboard() } })
      return
    }
    await dispatch(ctx, target, [], "", null)
    return
  }

  await answerCallbackQuery(token, callbackQueryId)
}

async function handlePlainText(ctx: CommandContext, rawText: string, entities: TelegramMessageEntity[] | undefined) {
  if (ctx.link.composeMode === "post") {
    await setComposeMode(ctx.userId, null)
    const html = telegramTextToPostHtml(rawText, entities ?? [])
    const result = await publishPost(ctx, html)
    await reply(ctx, result.text, result.opts)
    return
  }

  if (!ctx.link.activeConversationId) {
    await reply(
      ctx,
      `Not currently in a conversation. Use ${code("/inbox")} or ${code("/dm <username> <message>")} to start one — or tap ${b("New Post")} from ${code("/start")} to publish something instead.`,
    )
    return
  }
  const text = rawText.trim()
  const result = await sendMessageForUser(ctx.userId, ctx.link.activeConversationId, text)
  await reply(ctx, result.success ? "✅ Sent." : errorText("Couldn't send", result.error))
}

/** Shared by the /post command and compose-mode plain text — creates the post and formats the confirmation. */
async function publishPost(ctx: CommandContext, html: string): Promise<{
  text: string
  opts?: Parameters<typeof sendToLink>[2]
}>
async function publishPost(ctx: CommandContext, html: string) {
  const formData = new FormData()
  formData.set("content", html)
  const result = await createPostForUser(ctx.userId, formData)
  if (!result.success) {
    return { text: errorText("Couldn't post", result.error) }
  }
  return {
    text: `✅ ${b("Posted!")}`,
    opts: result.postId
      ? { replyMarkup: { inline_keyboard: [[{ text: "🌐 View on site", url: postUrl(result.postId) }]] } }
      : undefined,
  }
}

const POST_ACTIONS = {
  like: (userId: string, postId: string) => likePostForUser(userId, postId),
  unlike: (userId: string, postId: string) => unlikePostForUser(userId, postId),
  repost: (userId: string, postId: string) => repostPostForUser(userId, postId),
  unrepost: (userId: string, postId: string) => undoRepostForUser(userId, postId),
  bookmark: (userId: string, postId: string) => bookmarkPostForUser(userId, postId),
  unbookmark: (userId: string, postId: string) => removeBookmarkForUser(userId, postId),
} as const

const POST_ACTION_TOAST: Record<string, string> = {
  like: "❤️ Liked",
  unlike: "Removed",
  repost: "🔁 Reposted",
  unrepost: "Repost undone",
  bookmark: "🔖 Saved",
  unbookmark: "Removed from saved",
}

async function dispatch(
  ctx: CommandContext,
  command: string,
  args: string[],
  argLine: string,
  richArgHtml: string | null,
) {
  switch (command) {
    case "start":
      return sendWelcome(ctx)

    case "help":
      return reply(ctx, buildHelpText(), { replyMarkup: { inline_keyboard: mainMenuKeyboard() } })

    case "whoami": {
      const [row] = await db
        .select({ name: userTable.name, username: userTable.username, email: userTable.email })
        .from(userTable)
        .where(eq(userTable.id, ctx.userId))
        .limit(1)
      return reply(
        ctx,
        row
          ? `🪪 Linked as ${b(row.name)}${row.username ? ` (${code(`@${row.username}`)})` : ""} · ${esc(row.email)}`
          : "Couldn't find your account.",
      )
    }

    case "cancel": {
      const wasComposing = ctx.link.composeMode === "post"
      await setComposeMode(ctx.userId, null)
      await setActiveConversation(ctx.userId, null)
      return reply(ctx, wasComposing ? "✅ Compose mode cancelled." : "Nothing to cancel.")
    }

    case "unlink": {
      await unlink(ctx.userId)
      return reply(ctx, "🔌 Unlinked. This bot no longer has access to your account.")
    }

    case "verify": {
      const result = await confirmVerificationCode(ctx.userId, args[0] ?? "")
      return reply(ctx, result.success ? "✅ Verified." : errorText("Not verified", result.error))
    }

    // --- Profile ---
    case "me": {
      const profile = await getProfileByIdentifier(ctx.userId)
      if (!profile) return reply(ctx, "Couldn't load your profile.")
      const counts = await getFollowCounts(profile.id)
      return reply(
        ctx,
        [
          `👤 ${b(profile.name)}${profile.username ? ` ${code(`@${profile.username}`)}` : ""}`,
          profile.bio ? esc(profile.bio) : null,
          "",
          `Followers: ${b(String(counts.followers))} · Following: ${b(String(counts.following))}`,
        ]
          .filter((line) => line !== null)
          .join("\n"),
        { replyMarkup: { inline_keyboard: [[{ text: "🌐 Open profile", url: profileUrl(profile) }]] } },
      )
    }

    case "profile": {
      if (!args[0]) return reply(ctx, usage("/profile <username>"))
      const profile = await resolveUser(args[0])
      if (!profile) return reply(ctx, "❌ User not found.")
      const counts = await getFollowCounts(profile.id)
      const following = await isFollowing(ctx.userId, profile.id)
      return reply(
        ctx,
        [
          `👤 ${b(profile.name)}${profile.username ? ` ${code(`@${profile.username}`)}` : ""}`,
          profile.bio ? esc(profile.bio) : null,
          "",
          `Followers: ${b(String(counts.followers))} · Following: ${b(String(counts.following))}`,
          following ? "✅ You follow this account." : "You don't follow this account.",
        ]
          .filter((line) => line !== null)
          .join("\n"),
        {
          replyMarkup: {
            inline_keyboard: [
              [
                { text: following ? "➖ Unfollow" : "➕ Follow", callback_data: `act:${following ? "unfollow" : "follow"}user:${profile.id}` },
                { text: "🌐 Open profile", url: profileUrl(profile) },
              ],
            ],
          },
        },
      )
    }

    case "bio": {
      const bio = argLine.trim()
      if (bio.length > 160) return reply(ctx, "❌ Bio must be 160 characters or fewer.")
      await db
        .update(userTable)
        .set({ bio: bio || null, updatedAt: new Date() })
        .where(eq(userTable.id, ctx.userId))
      return reply(ctx, "✅ Bio updated.")
    }

    // --- Posts ---
    case "post": {
      const html = richArgHtml || (argLine ? `<p>${esc(argLine)}</p>` : "")
      if (!html) return reply(ctx, usage("/post <text>", "Tip: use Telegram's bold/italic/link formatting — it carries over to the site."))
      const result = await publishPost(ctx, html)
      return reply(ctx, result.text, result.opts)
    }

    case "delete": {
      if (!args[0]) return reply(ctx, usage("/delete <postId>"))
      const result = await deletePostForUser(ctx.userId, args[0])
      return reply(ctx, result.success ? "✅ Deleted." : errorText("Couldn't delete", result.error))
    }

    case "feed": {
      const posts = await getFeedPosts(ctx.userId, new Set(), LIST_PAGE_SIZE)
      if (posts.length === 0) return reply(ctx, `📰 ${b("Your feed")}\n\nNo posts yet — follow some people or check back later.`)
      await reply(ctx, `📰 ${b("Latest posts")}`)
      for (const post of posts) await sendPostCard(ctx, post)
      return reply(ctx, "That's everything for now.", {
        replyMarkup: {
          inline_keyboard: [[{ text: "🔄 Refresh", callback_data: "menu:feed" }, { text: "🏠 Menu", callback_data: "menu:home" }]],
        },
      })
    }

    case "view": {
      if (!args[0]) return reply(ctx, usage("/view <postId>"))
      const post = await resolvePostId(args[0], ctx.userId)
      if (!post) return reply(ctx, "❌ Post not found.")
      await reply(ctx, `🧵 ${b("Thread")}`)
      await sendPostCard(ctx, post, { viewButton: false })
      const replies = await getPostReplies(post.id, ctx.userId, new Set(), 5)
      if (replies.length) {
        await reply(ctx, `💬 ${b("Replies")}`)
        for (const r of replies) await sendPostCard(ctx, r, { viewButton: false })
      }
      return
    }

    // --- Engagement ---
    case "like":
      return replyInteraction(ctx, args[0], (postId) => likePostForUser(ctx.userId, postId))
    case "unlike":
      return replyInteraction(ctx, args[0], (postId) => unlikePostForUser(ctx.userId, postId))
    case "repost":
      return replyInteraction(ctx, args[0], (postId) => repostPostForUser(ctx.userId, postId))
    case "unrepost":
      return replyInteraction(ctx, args[0], (postId) => undoRepostForUser(ctx.userId, postId))
    case "bookmark":
      return replyInteraction(ctx, args[0], (postId) => bookmarkPostForUser(ctx.userId, postId))
    case "unbookmark":
      return replyInteraction(ctx, args[0], (postId) => removeBookmarkForUser(ctx.userId, postId))

    case "bookmarks": {
      const posts = await getBookmarkedPosts(ctx.userId, new Set(), LIST_PAGE_SIZE)
      if (posts.length === 0) return reply(ctx, `🔖 ${b("Bookmarks")}\n\nNo bookmarks yet.`)
      await reply(ctx, `🔖 ${b("Your bookmarks")}`)
      for (const post of posts) await sendPostCard(ctx, post)
      return
    }

    // --- Social graph ---
    case "follow": {
      if (!args[0]) return reply(ctx, usage("/follow <username>"))
      const target = await resolveUser(args[0])
      if (!target) return reply(ctx, "❌ User not found.")
      const result = await followUserForUser(ctx.userId, target.id, target.username ?? target.id)
      return reply(ctx, result.success ? `✅ Followed ${code(`@${args[0]}`)}.` : errorText("Couldn't follow", result.error))
    }

    case "unfollow": {
      if (!args[0]) return reply(ctx, usage("/unfollow <username>"))
      const target = await resolveUser(args[0])
      if (!target) return reply(ctx, "❌ User not found.")
      const result = await unfollowUserForUser(ctx.userId, target.id, target.username ?? target.id)
      return reply(ctx, result.success ? `✅ Unfollowed ${code(`@${args[0]}`)}.` : errorText("Couldn't unfollow", result.error))
    }

    case "followers": {
      const identifier = args[0] ?? ctx.userId
      const target = await resolveUser(identifier)
      if (!target) return reply(ctx, "❌ User not found.")
      const rows = await getFollowers(target.id, ctx.userId)
      if (rows.length === 0) return reply(ctx, "No followers yet.")
      return reply(
        ctx,
        rows.slice(0, LIST_PAGE_SIZE).map((r) => `• ${code(`@${r.username ?? r.id}`)} — ${esc(r.name)}`).join("\n"),
      )
    }

    case "following": {
      const identifier = args[0] ?? ctx.userId
      const target = await resolveUser(identifier)
      if (!target) return reply(ctx, "❌ User not found.")
      const rows = await getFollowing(target.id, ctx.userId)
      if (rows.length === 0) return reply(ctx, "Not following anyone yet.")
      return reply(
        ctx,
        rows.slice(0, LIST_PAGE_SIZE).map((r) => `• ${code(`@${r.username ?? r.id}`)} — ${esc(r.name)}`).join("\n"),
      )
    }

    // --- Notifications & search ---
    case "notifications": {
      const rows = await getNotifications(ctx.userId, LIST_PAGE_SIZE)
      if (rows.length === 0) return reply(ctx, `🔔 ${b("Notifications")}\n\nNothing yet.`)
      const verb = { follow: "followed you", like: "liked your post", reply: "replied to your post", repost: "reposted your post" }
      return reply(
        ctx,
        [
          `🔔 ${b("Notifications")}`,
          "",
          ...rows.map((n) => {
            const actor = n.actorUsername ? `@${n.actorUsername}` : n.actorName
            return `${n.isRead ? "" : "🔵 "}${code(esc(actor))} ${esc(verb[n.type])}`
          }),
        ].join("\n"),
      )
    }

    case "search": {
      if (!argLine) return reply(ctx, usage("/search <query>"))
      const blocked = await getBlockedUserIds(ctx.userId)
      const [users, posts] = await Promise.all([
        searchUsers(argLine, ctx.userId, blocked),
        searchPosts(argLine, ctx.userId, blocked),
      ])
      const userLines = users.slice(0, 5).map((u) => `• ${code(`@${u.username ?? u.id}`)} — ${esc(u.name)}`)
      if (userLines.length === 0 && posts.length === 0) return reply(ctx, "No results.")
      if (userLines.length) {
        await reply(ctx, [`🔍 ${b("Users")}`, ...userLines].join("\n"))
      }
      if (posts.length) {
        await reply(ctx, `🔍 ${b("Posts")}`)
        for (const post of posts.slice(0, 5)) await sendPostCard(ctx, post)
      }
      return
    }

    // --- Services / portfolio / testimonials (list/view/delete) ---
    case "services": {
      const target = args[0] ? await resolveUser(args[0]) : { id: ctx.userId }
      if (!target) return reply(ctx, "❌ User not found.")
      const rows = await getServices(target.id)
      if (rows.length === 0) return reply(ctx, "No services.")
      return reply(
        ctx,
        rows.map((s) => `🧾 ${code(`#${shortId(s.id)}`)} — ${esc(s.title)} (from $${s.startingPrice})`).join("\n"),
      )
    }
    case "service": {
      if (!args[0]) return reply(ctx, usage("/service <id>"))
      const service = await findOwnedByPrefix(args[0], (id) => getService(ctx.userId, id), () => getServices(ctx.userId))
      if (!service) return reply(ctx, "❌ Service not found.")
      return reply(
        ctx,
        `🧾 ${b(service.title)}\n${esc(service.tagline)}\nFrom $${service.startingPrice} · ${service.deliveryDays} days\n\n${esc(preview(service.description ?? ""))}`,
      )
    }
    case "delete-service": {
      if (!args[0]) return reply(ctx, usage("/delete-service <id>"))
      const id = await resolveIdPrefix(args[0], () => getServices(ctx.userId))
      if (!id) return reply(ctx, "❌ Service not found.")
      const result = await deleteServiceForUser(ctx.userId, id)
      return reply(ctx, result.success ? "✅ Deleted." : errorText("Couldn't delete", result.error))
    }

    case "portfolio": {
      const target = args[0] ? await resolveUser(args[0]) : { id: ctx.userId }
      if (!target) return reply(ctx, "❌ User not found.")
      const rows = await getPortfolioProjects(target.id)
      if (rows.length === 0) return reply(ctx, "No portfolio projects.")
      return reply(ctx, rows.map((p) => `📁 ${code(`#${shortId(p.id)}`)} — ${esc(p.title)}`).join("\n"))
    }
    case "project": {
      if (!args[0]) return reply(ctx, usage("/project <id>"))
      const project = await findOwnedByPrefix(args[0], (id) => getPortfolioProject(ctx.userId, id), () => getPortfolioProjects(ctx.userId))
      if (!project) return reply(ctx, "❌ Project not found.")
      return reply(ctx, `📁 ${b(project.title)}\n${esc(project.tagline)}\n\n${esc(preview(project.description ?? ""))}`)
    }
    case "delete-project": {
      if (!args[0]) return reply(ctx, usage("/delete-project <id>"))
      const id = await resolveIdPrefix(args[0], () => getPortfolioProjects(ctx.userId))
      if (!id) return reply(ctx, "❌ Project not found.")
      const result = await deletePortfolioProjectForUser(ctx.userId, id)
      return reply(ctx, result.success ? "✅ Deleted." : errorText("Couldn't delete", result.error))
    }

    case "testimonials": {
      const target = args[0] ? await resolveUser(args[0]) : { id: ctx.userId }
      if (!target) return reply(ctx, "❌ User not found.")
      const rows = await getTestimonials(target.id)
      if (rows.length === 0) return reply(ctx, "No testimonials.")
      return reply(
        ctx,
        rows.map((t) => `⭐ ${code(`#${shortId(t.id)}`)} — ${esc(t.authorName)}${t.rating ? ` (${t.rating}★)` : ""}`).join("\n"),
      )
    }
    case "testimonial": {
      if (!args[0]) return reply(ctx, usage("/testimonial <id>"))
      const testimonial = await findOwnedByPrefix(args[0], (id) => getTestimonial(ctx.userId, id), () => getTestimonials(ctx.userId))
      if (!testimonial) return reply(ctx, "❌ Testimonial not found.")
      return reply(
        ctx,
        `⭐ ${b(testimonial.authorName)}${testimonial.rating ? ` — ${testimonial.rating}★` : ""}\n\n${esc(preview(testimonial.content))}`,
      )
    }
    case "delete-testimonial": {
      if (!args[0]) return reply(ctx, usage("/delete-testimonial <id>"))
      const id = await resolveIdPrefix(args[0], () => getTestimonials(ctx.userId))
      if (!id) return reply(ctx, "❌ Testimonial not found.")
      const result = await deleteTestimonialForUser(ctx.userId, id)
      return reply(ctx, result.success ? "✅ Deleted." : errorText("Couldn't delete", result.error))
    }

    // --- Direct messages ---
    case "inbox": {
      const conversations = await getConversations(ctx.userId)
      if (conversations.length === 0) return reply(ctx, `✉️ ${b("Inbox")}\n\nNo conversations yet.`)
      return reply(
        ctx,
        [
          `✉️ ${b("Inbox")}`,
          "",
          ...conversations.slice(0, LIST_PAGE_SIZE).map((c, i) => {
            const other = c.otherUser.username ? `@${c.otherUser.username}` : c.otherUser.name
            const unread = c.unreadCount > 0 ? ` ${b(`(${c.unreadCount} unread)`)}` : ""
            return `${i + 1}. ${code(esc(other))}${unread}\n${c.lastMessage ? esc(preview(c.lastMessage.content, 80)) : ""}`
          }),
          "",
          esc("Reply with /dm <username> <message>, or tap a conversation's Reply button after a notification."),
        ].join("\n"),
      )
    }

    case "dm": {
      const [usernameArg, ...messageParts] = args
      const messageText = messageParts.join(" ")
      if (!usernameArg || !messageText) return reply(ctx, usage("/dm <username> <message>"))
      const target = await resolveUser(usernameArg)
      if (!target) return reply(ctx, "❌ User not found.")
      const started = await startConversationForUser(ctx.userId, target.id)
      if (!started.success) return reply(ctx, errorText("Couldn't message", started.error))
      const sent = await sendMessageForUser(ctx.userId, started.data.conversationId, messageText)
      if (!sent.success) return reply(ctx, errorText("Couldn't send", sent.error))
      await setActiveConversation(ctx.userId, started.data.conversationId)
      await markConversationRead(started.data.conversationId, ctx.userId)
      return reply(ctx, "✅ Sent.")
    }

    default:
      return reply(ctx, `🤔 Unknown command. Send ${code("/help")} to see everything I can do.`)
  }
}

async function replyInteraction(
  ctx: CommandContext,
  postId: string | undefined,
  action: (postId: string) => Promise<{ success: boolean; error?: string }>,
) {
  if (!postId) return reply(ctx, usage("<command> <postId>"))
  const post = await resolvePostId(postId, ctx.userId)
  if (!post) return reply(ctx, "❌ Post not found.")
  const result = await action(post.id)
  return reply(ctx, result.success ? "✅ Done." : errorText("Couldn't do that", result.error))
}

/** Resolves an 8-char id prefix (from a list command) against a set of owned rows. */
async function resolveIdPrefix(idOrPrefix: string, listOwned: () => Promise<{ id: string }[]>): Promise<string | null> {
  if (idOrPrefix.length >= 32) return idOrPrefix
  const rows = await listOwned()
  const match = rows.find((row) => row.id.startsWith(idOrPrefix))
  return match?.id ?? null
}

async function findOwnedByPrefix<T>(
  idOrPrefix: string,
  getById: (id: string) => Promise<T | null>,
  listOwned: () => Promise<{ id: string }[]>,
): Promise<T | null> {
  const direct = await getById(idOrPrefix)
  if (direct) return direct
  const resolvedId = await resolveIdPrefix(idOrPrefix, listOwned)
  return resolvedId ? getById(resolvedId) : null
}

// Deep-link helper for the "creating/editing is web-only" scope note
// (see usertgbot.md) — not wired to a command directly, kept here so
// future handlers (e.g. a future "how do I add a service" reply) can
// point back at the right settings page without duplicating the URL logic.
export function settingsDeepLink(path: string): string {
  return `${getSiteUrl()}${path}`
}
