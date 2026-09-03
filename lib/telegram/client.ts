import { decryptBotToken } from "@/lib/telegram/crypto"
import { logActionError } from "@/lib/log-action-error"

/**
 * Thin wrapper around the Telegram Bot API (see usertgbot.md). No SDK
 * dependency needed for this surface — every method is a single JSON
 * POST to `https://api.telegram.org/bot<token>/<method>`.
 */

const TELEGRAM_API_BASE = "https://api.telegram.org"

export class TelegramApiError extends Error {
  description: string
  constructor(description: string) {
    super(description)
    this.description = description
  }
}

async function callTelegramApi<T>(
  botToken: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })

  const json = (await response.json()) as { ok: boolean; result?: T; description?: string }
  if (!json.ok) {
    throw new TelegramApiError(json.description ?? `Telegram API call to ${method} failed.`)
  }
  return json.result as T
}

export type TelegramInlineKeyboardButton = {
  text: string
  callback_data?: string
  url?: string
}

export type TelegramMe = {
  id: number
  is_bot: boolean
  username?: string
  first_name: string
}

/**
 * Sends a chat message. `botToken` is the raw (already-decrypted, for
 * "custom" links) token or the shared built-in token — callers should
 * go through `resolveOutgoingToken` below rather than reading either
 * source directly, so the two bot kinds stay indistinguishable to the
 * rest of the codebase.
 */
export async function sendMessage(
  botToken: string,
  chatId: string,
  text: string,
  opts?: { replyMarkup?: { inline_keyboard: TelegramInlineKeyboardButton[][] }; parseMode?: "HTML" | "Markdown" },
): Promise<void> {
  try {
    await callTelegramApi(botToken, "sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: opts?.parseMode,
      reply_markup: opts?.replyMarkup,
      link_preview_options: { is_disabled: true },
    })
  } catch (error) {
    logActionError("telegramSendMessage", error, { chatId })
  }
}

export async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  try {
    await callTelegramApi(botToken, "answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text,
    })
  } catch (error) {
    logActionError("telegramAnswerCallbackQuery", error)
  }
}

/**
 * Updates only the inline keyboard of an existing message — used to
 * toggle a Like/Repost/Save button's label in place (e.g. "❤️ Like"
 * -> "💔 Unlike") right after the callback that triggered it,
 * instead of sending a new message for every tap.
 */
export async function editMessageReplyMarkup(
  botToken: string,
  chatId: string,
  messageId: number,
  replyMarkup: { inline_keyboard: TelegramInlineKeyboardButton[][] },
): Promise<void> {
  try {
    await callTelegramApi(botToken, "editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: replyMarkup,
    })
  } catch (error) {
    // Non-fatal: Telegram returns an error if the markup is unchanged
    // (e.g. a double-tap) or the message is too old to edit — the
    // action itself (like/repost/...) already succeeded regardless.
    logActionError("telegramEditMessageReplyMarkup", error, { chatId })
  }
}

export type TelegramBotCommand = { command: string; description: string }

/** Registers the "/" command-autocomplete menu shown by Telegram clients. */
export async function setMyCommands(botToken: string, commands: TelegramBotCommand[]): Promise<void> {
  try {
    await callTelegramApi(botToken, "setMyCommands", { commands })
  } catch (error) {
    logActionError("telegramSetMyCommands", error)
  }
}

/** Validates a token and returns the bot's own identity — used to validate a BYO token before saving it. */
export async function getMe(botToken: string): Promise<TelegramMe> {
  return callTelegramApi<TelegramMe>(botToken, "getMe")
}

/**
 * Registers `url` as the webhook for this bot, gated by `secretToken`
 * — Telegram echoes it back on every update as the
 * `X-Telegram-Bot-Api-Secret-Token` header, which the receiving route
 * must check before trusting the request body at all.
 */
export async function setWebhook(botToken: string, url: string, secretToken: string): Promise<void> {
  await callTelegramApi(botToken, "setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: ["message", "callback_query"],
  })
}

export async function deleteWebhook(botToken: string): Promise<void> {
  try {
    await callTelegramApi(botToken, "deleteWebhook", { drop_pending_updates: true })
  } catch (error) {
    logActionError("telegramDeleteWebhook", error)
  }
}

/** The shared built-in bot's token, from project env vars. */
export function getBuiltinBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    throw new Error(
      "[v0] Missing TELEGRAM_BOT_TOKEN. Create a bot via @BotFather and set this in the project's environment configuration before the built-in Telegram bot can be used.",
    )
  }
  return token
}

export function getBuiltinBotUsername(): string {
  const username = process.env.TELEGRAM_BOT_USERNAME
  if (!username) {
    throw new Error(
      "[v0] Missing TELEGRAM_BOT_USERNAME. Set this to the built-in bot's @username (without the @) in the project's environment configuration.",
    )
  }
  return username
}

type OutgoingTokenLink = { kind: string; botTokenEncrypted: string | null }

/**
 * Resolves which raw bot token to send through for a given link:
 * the shared `TELEGRAM_BOT_TOKEN` for a "builtin" link, or the
 * decrypted per-row token for a "custom" one. Every outgoing call
 * should go through this rather than reading either source directly.
 */
export function resolveOutgoingToken(link: OutgoingTokenLink): string {
  if (link.kind === "builtin") {
    return getBuiltinBotToken()
  }
  if (!link.botTokenEncrypted) {
    throw new Error("[v0] Custom Telegram link is missing its encrypted bot token.")
  }
  return decryptBotToken(link.botTokenEncrypted)
}
