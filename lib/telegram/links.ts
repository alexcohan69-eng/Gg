import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { telegramLinks } from "@/lib/db/schema"
import {
  decryptBotToken,
  encryptBotToken,
  generateVerificationCode,
  generateWebhookSecret,
} from "@/lib/telegram/crypto"
import {
  deleteWebhook,
  getBuiltinBotToken,
  getBuiltinBotUsername,
  getMe,
  resolveOutgoingToken,
  sendMessage,
  setWebhook,
} from "@/lib/telegram/client"
import { logActionError } from "@/lib/log-action-error"
import { getSiteUrl } from "@/lib/env"

/**
 * Link lifecycle for both bot kinds (see usertgbot.md). Every command
 * handler treats a link as "live" only once `verifiedAt` is set —
 * `confirmVerificationCode` is the single choke point that flips that
 * on, so no bot command can run against an unproven chat id.
 */

const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000

export type TelegramLink = typeof telegramLinks.$inferSelect

export { getSiteUrl }

export async function getLinkForUser(userId: string): Promise<TelegramLink | null> {
  const rows = await db.select().from(telegramLinks).where(eq(telegramLinks.userId, userId)).limit(1)
  return rows[0] ?? null
}

/** Builtin webhook lookups key off `chatId` — that route doesn't know the userId until a link exists. */
export async function getLinkByChatId(chatId: string): Promise<TelegramLink | null> {
  const rows = await db.select().from(telegramLinks).where(eq(telegramLinks.chatId, chatId)).limit(1)
  return rows[0] ?? null
}

/** Custom webhook lookups key off the URL's secret segment. */
export async function getLinkByWebhookSecret(secret: string): Promise<TelegramLink | null> {
  const rows = await db.select().from(telegramLinks).where(eq(telegramLinks.webhookSecret, secret)).limit(1)
  return rows[0] ?? null
}

// Registered at most once per cold start. `setWebhook` is idempotent
// on Telegram's side (calling it again with the same URL is a no-op),
// so this only exists to avoid one extra network round trip per
// request — never to guard correctness.
let builtinWebhookRegistered = false

/**
 * Points Telegram's `setWebhook` at this deployment's builtin route,
 * using the shared bot token + `TELEGRAM_WEBHOOK_SECRET`. Called
 * lazily from `startBuiltinLink` (mirroring how a custom bot's
 * webhook is registered in `startCustomLink` below) rather than at
 * module load, because `getSiteUrl()` needs the real request-time
 * deployment domain — which isn't reliably known until a request
 * actually comes in.
 */
async function ensureBuiltinWebhookRegistered(): Promise<void> {
  if (builtinWebhookRegistered) return
  const token = getBuiltinBotToken()
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!token || !secret) return
  try {
    await setWebhook(token, `${getSiteUrl()}/api/telegram/webhook/builtin`, secret)
    builtinWebhookRegistered = true
  } catch (error) {
    // Non-fatal: the deep link still works, and this is retried on
    // the next call since builtinWebhookRegistered stays false.
    logActionError("ensureBuiltinWebhookRegistered", error, {})
  }
}

/**
 * Starts (or restarts) a built-in-bot link for `userId` and returns
 * the `t.me/<bot>?start=<id>` deep link the settings page renders as
 * a button/QR code. No chat id is known yet — that arrives when the
 * user actually sends `/start <id>` to the bot, handled by
 * `completeBuiltinLink` below.
 */
export async function startBuiltinLink(userId: string): Promise<{ deepLink: string }> {
  const botUsername = getBuiltinBotUsername()
  await ensureBuiltinWebhookRegistered()
  const existing = await getLinkForUser(userId)
  const id = existing?.id ?? crypto.randomUUID()

  if (existing) {
    await db
      .update(telegramLinks)
      .set({
        kind: "builtin",
        chatId: null,
        botTokenEncrypted: null,
        botUsername: null,
        webhookSecret: null,
        verificationCode: null,
        verificationExpiresAt: null,
        verifiedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(telegramLinks.userId, userId))
  } else {
    await db.insert(telegramLinks).values({ id, userId, kind: "builtin" })
  }

  return { deepLink: `https://t.me/${botUsername}?start=${id}` }
}

/**
 * Called from the builtin webhook when `/start <id>` arrives from a
 * chat with no link row yet. Captures the chat id and sends the
 * one-time verification code to it.
 */
export async function completeBuiltinLink(startPayload: string, chatId: string): Promise<{ ok: boolean }> {
  const rows = await db
    .select()
    .from(telegramLinks)
    .where(and(eq(telegramLinks.id, startPayload), eq(telegramLinks.kind, "builtin")))
    .limit(1)
  const link = rows[0]
  if (!link) return { ok: false }

  const code = generateVerificationCode()
  await db
    .update(telegramLinks)
    .set({
      chatId,
      verificationCode: code,
      verificationExpiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS),
      updatedAt: new Date(),
    })
    .where(eq(telegramLinks.id, link.id))

  await sendMessage(
    getBuiltinBotToken(),
    chatId,
    `Your Web Banai verification code is: ${code}\n\nEnter it in Settings → Telegram to finish linking your account. It expires in 10 minutes.`,
  )

  return { ok: true }
}

/**
 * Validates `rawBotToken` against Telegram, registers it as
 * `userId`'s custom link, points its webhook at this app, and sends
 * the verification code to `chatId`.
 */
export async function startCustomLink(
  userId: string,
  rawBotToken: string,
  chatId: string,
): Promise<{ success: true; botUsername: string } | { success: false; error: string }> {
  const trimmedToken = rawBotToken.trim()
  const trimmedChatId = chatId.trim()
  if (!trimmedToken || !trimmedChatId) {
    return { success: false, error: "Bot token and chat ID are both required." }
  }

  let me: { username?: string }
  try {
    me = await getMe(trimmedToken)
  } catch {
    return { success: false, error: "That bot token doesn't look valid. Double-check it from @BotFather." }
  }
  if (!me.username) {
    return { success: false, error: "Couldn't resolve that bot's username." }
  }

  const existing = await getLinkForUser(userId)
  const id = existing?.id ?? crypto.randomUUID()
  const webhookSecret = generateWebhookSecret()
  const botTokenEncrypted = encryptBotToken(trimmedToken)
  const code = generateVerificationCode()

  // If the user is swapping from a previously-linked custom bot,
  // tear down its old webhook first so it stops receiving updates.
  if (existing?.kind === "custom" && existing.botTokenEncrypted) {
    try {
      await deleteWebhook(decryptBotToken(existing.botTokenEncrypted))
    } catch (error) {
      logActionError("startCustomLinkCleanupOldWebhook", error, { userId })
    }
  }

  if (existing) {
    await db
      .update(telegramLinks)
      .set({
        kind: "custom",
        chatId: trimmedChatId,
        botTokenEncrypted,
        botUsername: me.username,
        webhookSecret,
        verificationCode: code,
        verificationExpiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS),
        verifiedAt: null,
        activeConversationId: null,
        updatedAt: new Date(),
      })
      .where(eq(telegramLinks.userId, userId))
  } else {
    await db.insert(telegramLinks).values({
      id,
      userId,
      kind: "custom",
      chatId: trimmedChatId,
      botTokenEncrypted,
      botUsername: me.username,
      webhookSecret,
      verificationCode: code,
      verificationExpiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS),
    })
  }

  try {
    await setWebhook(trimmedToken, `${getSiteUrl()}/api/telegram/webhook/custom/${webhookSecret}`, webhookSecret)
  } catch {
    return {
      success: false,
      error: "Couldn't register the webhook with Telegram. Check the bot token and try again.",
    }
  }

  await sendMessage(
    trimmedToken,
    trimmedChatId,
    `Your Web Banai verification code is: ${code}\n\nEnter it in Settings → Telegram to finish linking your account. It expires in 10 minutes.`,
  )

  return { success: true, botUsername: me.username }
}

export type ConfirmResult = { success: true } | { success: false; error: string }

/**
 * The single choke point that turns a link "live". Scoped to the
 * caller's own row — a code is meaningless outside the userId that
 * requested it.
 */
export async function confirmVerificationCode(userId: string, code: string): Promise<ConfirmResult> {
  const link = await getLinkForUser(userId)
  if (!link || !link.verificationCode || !link.verificationExpiresAt) {
    return { success: false, error: "No pending verification. Start linking again." }
  }
  if (link.verificationExpiresAt.getTime() < Date.now()) {
    return { success: false, error: "That code expired. Start linking again to get a new one." }
  }
  if (link.verificationCode !== code.trim()) {
    return { success: false, error: "That code doesn't match." }
  }

  await db
    .update(telegramLinks)
    .set({ verifiedAt: new Date(), verificationCode: null, verificationExpiresAt: null, updatedAt: new Date() })
    .where(eq(telegramLinks.id, link.id))

  return { success: true }
}

/** Unlinks `userId`'s bot — tears down a custom bot's webhook first, then removes the row. */
export async function unlink(userId: string): Promise<void> {
  const link = await getLinkForUser(userId)
  if (!link) return

  if (link.kind === "custom" && link.botTokenEncrypted) {
    try {
      await deleteWebhook(decryptBotToken(link.botTokenEncrypted))
    } catch (error) {
      logActionError("unlinkTelegram", error, { userId })
    }
  }

  await db.delete(telegramLinks).where(eq(telegramLinks.userId, userId))
}

/** Sends a message to `link`'s chat using whichever bot token applies to it. */
export async function sendToLink(link: TelegramLink, text: string, opts?: Parameters<typeof sendMessage>[3]) {
  if (!link.chatId) return
  await sendMessage(resolveOutgoingToken(link), link.chatId, text, opts)
}

/** Updates which conversation a plain-text reply from this link's chat should be routed into. */
export async function setActiveConversation(userId: string, conversationId: string | null): Promise<void> {
  await db
    .update(telegramLinks)
    .set({ activeConversationId: conversationId, updatedAt: new Date() })
    .where(eq(telegramLinks.userId, userId))
}
