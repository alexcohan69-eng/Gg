"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { getSessionWithRetry } from "@/lib/auth"
import {
  getLinkForUser,
  startBuiltinLink,
  startCustomLink,
  confirmVerificationCode,
  unlink,
  sendToLink,
} from "@/lib/telegram/links"
import { logActionError } from "@/lib/log-action-error"

/**
 * Session-authenticated entry points for the /settings/telegram page
 * (see usertgbot.md). Not part of the public /api/v1 surface — these
 * are the web app's own settings actions, same pattern as
 * app/actions/api-keys.ts.
 */

async function getUserId() {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

/** Public shape of the current user's link — never includes the encrypted bot token. */
export type TelegramLinkSummary = {
  kind: "builtin" | "custom"
  botUsername: string | null
  chatId: string | null
  isVerified: boolean
  hasPendingCode: boolean
}

export async function getMyTelegramLink(): Promise<TelegramLinkSummary | null> {
  const userId = await getUserId()
  const link = await getLinkForUser(userId)
  if (!link) return null

  return {
    kind: link.kind as "builtin" | "custom",
    botUsername: link.botUsername,
    chatId: link.chatId,
    isVerified: link.verifiedAt !== null,
    hasPendingCode: link.verificationCode !== null,
  }
}

export type StartLinkResult = { success: true; deepLink: string } | { success: false; error: string }

/** Starts (or restarts) linking to the site's shared built-in bot. */
export async function startBuiltinTelegramLink(): Promise<StartLinkResult> {
  const userId = await getUserId()
  try {
    const { deepLink } = await startBuiltinLink(userId)
    revalidatePath("/settings/telegram")
    return { success: true, deepLink }
  } catch (error) {
    logActionError("startBuiltinTelegramLink", error, { userId })
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Couldn't start linking. Try again.",
    }
  }
}

export type StartCustomResult = { success: true; botUsername: string } | { success: false; error: string }

/** Starts linking to the user's own bot — validates the token, registers the webhook, sends the code. */
export async function startCustomTelegramLink(formData: FormData): Promise<StartCustomResult> {
  const userId = await getUserId()
  const botToken = String(formData.get("botToken") ?? "")
  const chatId = String(formData.get("chatId") ?? "")

  const result = await startCustomLink(userId, botToken, chatId)
  if (!result.success) return result

  revalidatePath("/settings/telegram")
  return result
}

export type ConfirmResult = { success: true } | { success: false; error: string }

/** Confirms the ownership-verification code, activating the link. */
export async function confirmTelegramCode(formData: FormData): Promise<ConfirmResult> {
  const userId = await getUserId()
  const code = String(formData.get("code") ?? "")
  const result = await confirmVerificationCode(userId, code)
  if (result.success) revalidatePath("/settings/telegram")
  return result
}

export type UnlinkResult = { success: boolean }

export async function unlinkTelegram(): Promise<UnlinkResult> {
  const userId = await getUserId()
  await unlink(userId)
  revalidatePath("/settings/telegram")
  return { success: true }
}

export type TestMessageResult = { success: true } | { success: false; error: string }

/** Sends a test message to the linked chat, so the user can confirm it's actually working. */
export async function sendTestTelegramMessage(): Promise<TestMessageResult> {
  const userId = await getUserId()
  const link = await getLinkForUser(userId)
  if (!link || !link.verifiedAt) {
    return { success: false, error: "Link your Telegram bot first." }
  }

  await sendToLink(link, "✅ This is a test message from Web Banai. Your bot is connected — send /help to see every command.")
  return { success: true }
}
