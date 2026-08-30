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
import {
  unlink,
  sendToLink,
  setActiveConversation,
  getSiteUrl,
  confirmVerificationCode,
  type TelegramLink,
} from "@/lib/telegram/links"

/**
 * Full command dispatcher (see usertgbot.md). Every handler here
 * reuses the same app/actions/*.ts / lib/*.ts functions the web app
 * and the public /api/v1 API already use — never a re-implementation
 * — so behavior can never drift between surfaces. `handleUpdate` is
 * the single entry point shared by both webhook routes.
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

function formatPostLine(post: FeedPost): string {
  const author = post.authorUsername ? `@${post.authorUsername}` : post.authorName
  return `${post.id}\n${author}: ${preview(post.content)}\n♥ ${post.likeCount} · ↩ ${post.replyCount} · ⟲ ${post.repostCount}`
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
  await sendToLink(ctx.link, text, opts)
}

async function resolveUser(identifier: string) {
  return getProfileByIdentifier(identifier.replace(/^@/, ""))
}

const HELP_TEXT = `Web Banai commands:

Profile
/me — your profile summary
/profile <username> — view a profile
/bio <text> — update your bio

Posts
/post <text> — publish a post
/delete <postId> — delete your post
/feed — latest posts
/view <postId> — view a post + its replies

Engagement
/like /unlike /repost /unrepost /bookmark /unbookmark <postId>
/bookmarks — your bookmarked posts

Social
/follow /unfollow <username>
/followers /following <username>

Notifications & search
/notifications
/search <query>

Services / portfolio / testimonials
/services /portfolio /testimonials [username]
/service /project /testimonial <id>
/delete-service /delete-project /delete-testimonial <id>
(Creating/editing these is rich content — reply links you to the site.)

Direct messages
/inbox — your conversations
/dm <username> <message> — send a DM
Just type a reply after a DM notification to send it back.

Account
/whoami — which account you're linked as
/unlink — disconnect this bot`

export async function handleUpdate(link: TelegramLink, update: Record<string, unknown>): Promise<void> {
  if (!link.verifiedAt) return // hard guarantee — routes already check this too

  const chatId = link.chatId!
  const userId = link.userId
  const ctx: CommandContext = { link, userId, chatId }

  const callbackQuery = update.callback_query as { data?: string; id?: string } | undefined
  if (callbackQuery?.data) {
    await handleCallback(ctx, callbackQuery.data)
    return
  }

  const message = update.message as { text?: string } | undefined
  const text = message?.text?.trim()
  if (!text) return

  if (!text.startsWith("/")) {
    await handlePlainText(ctx, text)
    return
  }

  const [rawCommand, ...rest] = text.split(/\s+/)
  const command = rawCommand.slice(1).split("@")[0].toLowerCase()
  const argLine = text.slice(rawCommand.length).trim()
  const args = rest

  try {
    await dispatch(ctx, command, args, argLine)
  } catch (error) {
    await reply(ctx, `Something went wrong: ${error instanceof Error ? error.message : "unknown error"}`)
  }
}

async function handleCallback(ctx: CommandContext, data: string) {
  if (data.startsWith("reply:")) {
    const conversationId = data.slice("reply:".length)
    await setActiveConversation(ctx.userId, conversationId)
    await reply(ctx, "Type your reply and send it as a normal message.")
  }
}

async function handlePlainText(ctx: CommandContext, text: string) {
  if (!ctx.link.activeConversationId) {
    await reply(ctx, "Not currently in a conversation. Use /inbox or /dm <username> <message> to start one.")
    return
  }
  const result = await sendMessageForUser(ctx.userId, ctx.link.activeConversationId, text)
  await reply(ctx, result.success ? "✅ Sent." : `Couldn't send: ${result.error}`)
}

async function dispatch(ctx: CommandContext, command: string, args: string[], argLine: string) {
  switch (command) {
    case "help":
    case "start":
      return reply(ctx, HELP_TEXT)

    case "whoami": {
      const [row] = await db
        .select({ name: userTable.name, username: userTable.username, email: userTable.email })
        .from(userTable)
        .where(eq(userTable.id, ctx.userId))
        .limit(1)
      return reply(
        ctx,
        row
          ? `Linked as ${row.name}${row.username ? ` (@${row.username})` : ""} · ${row.email}`
          : "Couldn't find your account.",
      )
    }

    case "unlink": {
      await unlink(ctx.userId)
      return reply(ctx, "Unlinked. This bot no longer has access to your account.")
    }

    case "verify": {
      const result = await confirmVerificationCode(ctx.userId, args[0] ?? "")
      return reply(ctx, result.success ? "✅ Verified." : `Not verified: ${result.error}`)
    }

    // --- Profile ---
    case "me": {
      const profile = await getProfileByIdentifier(ctx.userId)
      if (!profile) return reply(ctx, "Couldn't load your profile.")
      const counts = await getFollowCounts(profile.id)
      return reply(
        ctx,
        `${profile.name}${profile.username ? ` (@${profile.username})` : ""}\n${profile.bio ?? ""}\n\nFollowers: ${counts.followers} · Following: ${counts.following}`,
      )
    }

    case "profile": {
      if (!args[0]) return reply(ctx, "Usage: /profile <username>")
      const profile = await resolveUser(args[0])
      if (!profile) return reply(ctx, "User not found.")
      const counts = await getFollowCounts(profile.id)
      const following = await isFollowing(ctx.userId, profile.id)
      return reply(
        ctx,
        `${profile.name}${profile.username ? ` (@${profile.username})` : ""}\n${profile.bio ?? ""}\n\nFollowers: ${counts.followers} · Following: ${counts.following}\n${following ? "You follow this account." : "You don't follow this account."}`,
      )
    }

    case "bio": {
      const bio = argLine.trim()
      if (bio.length > 160) return reply(ctx, "Bio must be 160 characters or fewer.")
      await db
        .update(userTable)
        .set({ bio: bio || null, updatedAt: new Date() })
        .where(eq(userTable.id, ctx.userId))
      return reply(ctx, "✅ Bio updated.")
    }

    // --- Posts ---
    case "post": {
      if (!argLine) return reply(ctx, "Usage: /post <text>")
      const formData = new FormData()
      formData.set("content", argLine)
      const result = await createPostForUser(ctx.userId, formData)
      return reply(ctx, result.success ? "✅ Posted." : `Couldn't post: ${result.error}`)
    }

    case "delete": {
      if (!args[0]) return reply(ctx, "Usage: /delete <postId>")
      const result = await deletePostForUser(ctx.userId, args[0])
      return reply(ctx, result.success ? "✅ Deleted." : `Couldn't delete: ${result.error}`)
    }

    case "feed": {
      const posts = await getFeedPosts(ctx.userId, new Set(), LIST_PAGE_SIZE)
      if (posts.length === 0) return reply(ctx, "Feed is empty.")
      return reply(ctx, posts.map(formatPostLine).join("\n\n"))
    }

    case "view": {
      if (!args[0]) return reply(ctx, "Usage: /view <postId>")
      const post = await resolvePostId(args[0], ctx.userId)
      if (!post) return reply(ctx, "Post not found.")
      const replies = await getPostReplies(post.id, ctx.userId, new Set(), 5)
      const repliesText = replies.length
        ? `\n\nReplies:\n${replies.map(formatPostLine).join("\n\n")}`
        : ""
      return reply(ctx, `${formatPostLine(post)}${repliesText}`)
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
      if (posts.length === 0) return reply(ctx, "No bookmarks yet.")
      return reply(ctx, posts.map(formatPostLine).join("\n\n"))
    }

    // --- Social graph ---
    case "follow": {
      if (!args[0]) return reply(ctx, "Usage: /follow <username>")
      const target = await resolveUser(args[0])
      if (!target) return reply(ctx, "User not found.")
      const result = await followUserForUser(ctx.userId, target.id, target.username ?? target.id)
      return reply(ctx, result.success ? `✅ Followed @${args[0]}.` : `Couldn't follow: ${result.error}`)
    }

    case "unfollow": {
      if (!args[0]) return reply(ctx, "Usage: /unfollow <username>")
      const target = await resolveUser(args[0])
      if (!target) return reply(ctx, "User not found.")
      const result = await unfollowUserForUser(ctx.userId, target.id, target.username ?? target.id)
      return reply(ctx, result.success ? `✅ Unfollowed @${args[0]}.` : `Couldn't unfollow: ${result.error}`)
    }

    case "followers": {
      const identifier = args[0] ?? ctx.userId
      const target = await resolveUser(identifier)
      if (!target) return reply(ctx, "User not found.")
      const rows = await getFollowers(target.id, ctx.userId)
      if (rows.length === 0) return reply(ctx, "No followers yet.")
      return reply(ctx, rows.slice(0, LIST_PAGE_SIZE).map((r) => `@${r.username ?? r.id} — ${r.name}`).join("\n"))
    }

    case "following": {
      const identifier = args[0] ?? ctx.userId
      const target = await resolveUser(identifier)
      if (!target) return reply(ctx, "User not found.")
      const rows = await getFollowing(target.id, ctx.userId)
      if (rows.length === 0) return reply(ctx, "Not following anyone yet.")
      return reply(ctx, rows.slice(0, LIST_PAGE_SIZE).map((r) => `@${r.username ?? r.id} — ${r.name}`).join("\n"))
    }

    // --- Notifications & search ---
    case "notifications": {
      const rows = await getNotifications(ctx.userId, LIST_PAGE_SIZE)
      if (rows.length === 0) return reply(ctx, "No notifications.")
      return reply(
        ctx,
        rows
          .map((n) => {
            const actor = n.actorUsername ? `@${n.actorUsername}` : n.actorName
            const verb = { follow: "followed you", like: "liked your post", reply: "replied to your post", repost: "reposted your post" }[n.type]
            return `${n.isRead ? "" : "🔵 "}${actor} ${verb}`
          })
          .join("\n"),
      )
    }

    case "search": {
      if (!argLine) return reply(ctx, "Usage: /search <query>")
      const blocked = await getBlockedUserIds(ctx.userId)
      const [users, posts] = await Promise.all([
        searchUsers(argLine, ctx.userId, blocked),
        searchPosts(argLine, ctx.userId, blocked),
      ])
      const userLines = users.slice(0, 5).map((u) => `@${u.username ?? u.id} — ${u.name}`)
      const postLines = posts.slice(0, 5).map(formatPostLine)
      if (userLines.length === 0 && postLines.length === 0) return reply(ctx, "No results.")
      return reply(
        ctx,
        [
          userLines.length ? `Users:\n${userLines.join("\n")}` : null,
          postLines.length ? `Posts:\n${postLines.join("\n\n")}` : null,
        ]
          .filter(Boolean)
          .join("\n\n"),
      )
    }

    // --- Services / portfolio / testimonials (list/view/delete) ---
    case "services": {
      const target = args[0] ? await resolveUser(args[0]) : { id: ctx.userId }
      if (!target) return reply(ctx, "User not found.")
      const rows = await getServices(target.id)
      if (rows.length === 0) return reply(ctx, "No services.")
      return reply(ctx, rows.map((s) => `#${shortId(s.id)} — ${s.title} (from $${s.startingPrice})`).join("\n"))
    }
    case "service": {
      if (!args[0]) return reply(ctx, "Usage: /service <id>")
      const service = await findOwnedByPrefix(args[0], (id) => getService(ctx.userId, id), () => getServices(ctx.userId))
      if (!service) return reply(ctx, "Service not found.")
      return reply(ctx, `${service.title}\n${service.tagline}\nFrom $${service.startingPrice} · ${service.deliveryDays} days\n\n${preview(service.description ?? "")}`)
    }
    case "delete-service": {
      if (!args[0]) return reply(ctx, "Usage: /delete-service <id>")
      const id = await resolveIdPrefix(args[0], () => getServices(ctx.userId))
      if (!id) return reply(ctx, "Service not found.")
      const result = await deleteServiceForUser(ctx.userId, id)
      return reply(ctx, result.success ? "✅ Deleted." : `Couldn't delete: ${result.error}`)
    }

    case "portfolio": {
      const target = args[0] ? await resolveUser(args[0]) : { id: ctx.userId }
      if (!target) return reply(ctx, "User not found.")
      const rows = await getPortfolioProjects(target.id)
      if (rows.length === 0) return reply(ctx, "No portfolio projects.")
      return reply(ctx, rows.map((p) => `#${shortId(p.id)} — ${p.title}`).join("\n"))
    }
    case "project": {
      if (!args[0]) return reply(ctx, "Usage: /project <id>")
      const project = await findOwnedByPrefix(args[0], (id) => getPortfolioProject(ctx.userId, id), () => getPortfolioProjects(ctx.userId))
      if (!project) return reply(ctx, "Project not found.")
      return reply(ctx, `${project.title}\n${project.tagline}\n\n${preview(project.description ?? "")}`)
    }
    case "delete-project": {
      if (!args[0]) return reply(ctx, "Usage: /delete-project <id>")
      const id = await resolveIdPrefix(args[0], () => getPortfolioProjects(ctx.userId))
      if (!id) return reply(ctx, "Project not found.")
      const result = await deletePortfolioProjectForUser(ctx.userId, id)
      return reply(ctx, result.success ? "✅ Deleted." : `Couldn't delete: ${result.error}`)
    }

    case "testimonials": {
      const target = args[0] ? await resolveUser(args[0]) : { id: ctx.userId }
      if (!target) return reply(ctx, "User not found.")
      const rows = await getTestimonials(target.id)
      if (rows.length === 0) return reply(ctx, "No testimonials.")
      return reply(ctx, rows.map((t) => `#${shortId(t.id)} — ${t.authorName}${t.rating ? ` (${t.rating}★)` : ""}`).join("\n"))
    }
    case "testimonial": {
      if (!args[0]) return reply(ctx, "Usage: /testimonial <id>")
      const testimonial = await findOwnedByPrefix(args[0], (id) => getTestimonial(ctx.userId, id), () => getTestimonials(ctx.userId))
      if (!testimonial) return reply(ctx, "Testimonial not found.")
      return reply(ctx, `${testimonial.authorName}${testimonial.rating ? ` — ${testimonial.rating}★` : ""}\n\n${preview(testimonial.content)}`)
    }
    case "delete-testimonial": {
      if (!args[0]) return reply(ctx, "Usage: /delete-testimonial <id>")
      const id = await resolveIdPrefix(args[0], () => getTestimonials(ctx.userId))
      if (!id) return reply(ctx, "Testimonial not found.")
      const result = await deleteTestimonialForUser(ctx.userId, id)
      return reply(ctx, result.success ? "✅ Deleted." : `Couldn't delete: ${result.error}`)
    }

    // --- Direct messages ---
    case "inbox": {
      const conversations = await getConversations(ctx.userId)
      if (conversations.length === 0) return reply(ctx, "No conversations yet.")
      return reply(
        ctx,
        conversations
          .slice(0, LIST_PAGE_SIZE)
          .map((c, i) => {
            const other = c.otherUser.username ? `@${c.otherUser.username}` : c.otherUser.name
            const unread = c.unreadCount > 0 ? ` (${c.unreadCount} unread)` : ""
            return `${i + 1}. ${other}${unread}\n${c.lastMessage ? preview(c.lastMessage.content, 80) : ""}`
          })
          .join("\n\n") + "\n\nReply with /dm <username> <message> to send a message, or tap a conversation's Reply button after a notification.",
      )
    }

    case "dm": {
      const [usernameArg, ...messageParts] = args
      const messageText = messageParts.join(" ")
      if (!usernameArg || !messageText) return reply(ctx, "Usage: /dm <username> <message>")
      const target = await resolveUser(usernameArg)
      if (!target) return reply(ctx, "User not found.")
      const started = await startConversationForUser(ctx.userId, target.id)
      if (!started.success) return reply(ctx, `Couldn't message: ${started.error}`)
      const sent = await sendMessageForUser(ctx.userId, started.data.conversationId, messageText)
      if (!sent.success) return reply(ctx, `Couldn't send: ${sent.error}`)
      await setActiveConversation(ctx.userId, started.data.conversationId)
      await markConversationRead(started.data.conversationId, ctx.userId)
      return reply(ctx, "✅ Sent.")
    }

    default:
      return reply(ctx, `Unknown command. Send /help to see everything I can do.`)
  }
}

async function replyInteraction(
  ctx: CommandContext,
  postId: string | undefined,
  action: (postId: string) => Promise<{ success: boolean; error?: string }>,
) {
  if (!postId) return reply(ctx, "Usage: <command> <postId>")
  const post = await resolvePostId(postId, ctx.userId)
  if (!post) return reply(ctx, "Post not found.")
  const result = await action(post.id)
  return reply(ctx, result.success ? "✅ Done." : `Couldn't do that: ${result.error}`)
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
