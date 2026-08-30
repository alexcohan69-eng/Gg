import { NextResponse } from "next/server"
import { getLinkByWebhookSecret } from "@/lib/telegram/links"
import { handleUpdate } from "@/lib/telegram/commands"
import { logActionError } from "@/lib/log-action-error"

/**
 * Webhook for a user's own ("BYO") bot (see usertgbot.md). Trusted
 * only when BOTH the URL's `[secret]` segment AND the
 * `X-Telegram-Bot-Api-Secret-Token` header match this link's own
 * `webhookSecret` — defense in depth against a leaked URL alone (the
 * header can't be forged by anyone but Telegram, since it's set via
 * `setWebhook`'s `secret_token` and never exposed to the user).
 *
 * Always returns 200 — see the builtin route for why.
 */
export async function POST(request: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params
  const secretHeader = request.headers.get("x-telegram-bot-api-secret-token")
  if (!secretHeader || secretHeader !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const link = await getLinkByWebhookSecret(secret)
  if (!link || link.webhookSecret !== secretHeader || link.kind !== "custom") {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  let update: Record<string, unknown>
  try {
    update = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  try {
    if (link.verifiedAt) {
      await handleUpdate(link, update)
    }
  } catch (error) {
    logActionError("telegramCustomWebhook", error, { userId: link.userId })
  }

  return NextResponse.json({ ok: true })
}
