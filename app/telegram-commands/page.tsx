import type { Metadata } from "next"
import Link from "next/link"
import { SendIcon, ShieldCheckIcon } from "lucide-react"
import { TELEGRAM_COMMAND_GROUPS } from "@/lib/telegram-commands-data"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { CodeBlock } from "@/components/docs/code-block"
import { DocsNav } from "@/components/docs/docs-nav"

export const metadata: Metadata = {
  title: "Telegram bot commands",
  description: "Manage your Web Banai account from Telegram — every available command.",
  robots: { index: true, follow: true },
}

export default function TelegramCommandsPage() {
  return (
    <main className="min-h-svh bg-background">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-6">
        <Link href="/" aria-label="Web Banai home">
          <Logo />
        </Link>
        <Button variant="outline" nativeButton={false} render={<Link href="/settings/telegram" />}>
          <SendIcon data-icon="inline-start" />
          Connect Telegram
        </Button>
      </header>

      <div className="mx-auto w-full max-w-4xl px-6 pb-24">
        <section className="flex flex-col gap-3 py-8 sm:py-12">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            Manage Web Banai from Telegram
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-pretty text-muted-foreground">
            Link the built-in bot or your own from @BotFather, then post, follow, message, and manage your account
            entirely from a chat.
          </p>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent">
              <ShieldCheckIcon className="size-4 text-accent-foreground" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="font-heading text-base font-semibold text-foreground">Verified before it can act</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Linking either bot requires entering a one-time code sent to that exact chat — a mistyped chat ID
                can never gain access. Every command acts only as the linked account, never anyone else&apos;s.
              </p>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4 py-8 sm:py-10">
          <div className="flex flex-col gap-1.5">
            <h2 className="font-heading text-lg font-semibold text-foreground">Getting started</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Go to{" "}
              <Link href="/settings/telegram" className="text-primary underline underline-offset-2 hover:no-underline">
                Settings → Telegram
              </Link>
              , choose the built-in bot or connect your own, then enter the code it sends you. Once verified, send{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">/help</code> to the bot any time to
              see this list from Telegram.
            </p>
            <CodeBlock code={"/help"} />
          </div>

          <div className="flex flex-col gap-1.5 rounded-xl border border-dashed border-border p-4">
            <h2 className="font-heading text-sm font-semibold text-foreground">Known gaps</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              No rate limiting yet — build responsibly. Creating or editing services/portfolio/testimonials isn&apos;t
              supported over chat (that content is rich text and media); those commands link back to the site
              instead.
            </p>
          </div>
        </section>

        <DocsNav groups={TELEGRAM_COMMAND_GROUPS.map((g) => ({ id: g.id, title: g.title }))} />

        <div className="flex flex-col gap-12 pt-8">
          {TELEGRAM_COMMAND_GROUPS.map((group) => (
            <section key={group.id} id={group.id} className="flex flex-col gap-4 scroll-mt-24">
              <div className="flex flex-col gap-1">
                <h2 className="font-heading text-xl font-semibold text-foreground">{group.title}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{group.description}</p>
              </div>
              <div className="flex flex-col gap-3">
                {group.commands.map((cmd) => (
                  <div key={cmd.command} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
                    <code className="font-mono text-sm font-medium text-foreground">{cmd.command}</code>
                    <p className="text-sm leading-relaxed text-muted-foreground">{cmd.description}</p>
                    <CodeBlock code={cmd.example} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-between gap-4 sm:flex-row">
          <Logo className="text-base" />
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Web Banai. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  )
}
