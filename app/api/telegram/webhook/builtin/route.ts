import { NextResponse } from "next/server"
import { getLinkByChatId, completeBuiltinLink } from "@/lib/telegram/links"
import { handleUpdate } from "@/lib/telegram/commands"
import { logActionError } from "@/lib/log-action-error"

/**
 * Webhook for the shared built-in bot (see usertgbot.md). Gated by a
 * single shared secret (`TELEGRAM_WEBHOOK_SECRET`) since there's only
 * one bot at this URL — contrast with the per-user secret path used
 * by `app/api/telegram/webhook/custom/[secret]/route.ts`.
 *
 * Always returns 200 (Telegram retries aggressively on non-200s) even
 * when the dispatched command itself failed — user-facing errors are
 * reported back as a chat message, not via HTTP status.
 */
export async function POST(request: Request) {
  const secretHeader = request.headers.get("x-telegram-bot-api-secret-token")
  if (!secretHeader || secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  let update: Record<string, unknown>
  try {
    update = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  try {
    const message = update.message as { text?: string; chat?: { id?: number | string } } | undefined
    const chatId = message?.chat?.id != null ? String(message.chat.id) : null
    const text = message?.text?.trim()

    if (chatId && text?.startsWith("/start")) {
      const startPayload = text.slice("/start".length).trim()
      const existingLink = await getLinkByChatId(chatId)
      if (!existingLink && startPayload) {
        await completeBuiltinLink(startPayload, chatId)
        return NextResponse.json({ ok: true })
      }
    }

    const callbackQuery = update.callback_query as { message?: { chat?: { id?: number | string } } } | undefined
    const callbackChatId = callbackQuery?.message?.chat?.id != null ? String(callbackQuery.message.chat.id) : null
    const resolvedChatId = chatId ?? callbackChatId
    if (!resolvedChatId) return NextResponse.json({ ok: true })

    const link = await getLinkByChatId(resolvedChatId)
    if (!link) return NextResponse.json({ ok: true })
    if (!link.verifiedAt) return NextResponse.json({ ok: true })

    await handleUpdate(link, update)
  } catch (error) {
    logActionError("telegramBuiltinWebhook", error)
  }

  return NextResponse.json({ ok: true })
}
