import type { Metadata } from "next"
import Link from "next/link"
import { KeyIcon, ShieldCheckIcon } from "lucide-react"
import { API_GROUPS, ERROR_EXAMPLE } from "@/lib/api-docs-data"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { CodeBlock } from "@/components/docs/code-block"
import { EndpointCard } from "@/components/docs/endpoint-card"
import { DocsNav } from "@/components/docs/docs-nav"

export const metadata: Metadata = {
  title: "Developer API",
  description: "Build your own tools and apps on top of Pulse's public REST API.",
  robots: { index: true, follow: true },
}

// Same resolution order as lib/auth.ts / app/layout.tsx, so the docs
// always show the domain the app is actually running on rather than a
// hardcoded placeholder.
const siteUrl =
  process.env.BETTER_AUTH_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : (process.env.V0_RUNTIME_URL ?? "http://localhost:3000"))

export default function DevelopersPage() {
  return (
    <main className="min-h-svh bg-background">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-6">
        <Link href="/" aria-label="Pulse home">
          <Logo />
        </Link>
        <Button variant="outline" nativeButton={false} render={<Link href="/settings/developer" />}>
          <KeyIcon data-icon="inline-start" />
          Manage API keys
        </Button>
      </header>

      <div className="mx-auto w-full max-w-4xl px-6 pb-24">
        <section className="flex flex-col gap-3 py-8 sm:py-12">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            Pulse API
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-pretty text-muted-foreground">
            A public, versioned REST API for building your own tools on top of
            Pulse — read public content freely, and act as yourself wherever
            you bring your own API key.
          </p>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent">
              <ShieldCheckIcon className="size-4 text-accent-foreground" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="font-heading text-base font-semibold text-foreground">
                Scoped to your own account, always
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                An API key can read any public content, but can only write
                as the account that created it. There is no way for a key
                to read or modify another user&apos;s private data,
                posts, or settings — every write endpoint checks
                ownership before it touches anything.
              </p>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4 py-8 sm:py-10">
          <div className="flex flex-col gap-1.5">
            <h2 className="font-heading text-lg font-semibold text-foreground">Base URL</h2>
            <CodeBlock code={`${siteUrl}/api/v1`} />
          </div>

          <div className="flex flex-col gap-1.5">
            <h2 className="font-heading text-lg font-semibold text-foreground">Authentication</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Generate a key from{" "}
              <Link href="/settings/developer" className="text-primary underline underline-offset-2 hover:no-underline">
                Settings → Developer
              </Link>
              , then send it as a bearer token on any authenticated request.
              Public GET endpoints work with no key at all; passing one just
              adds viewer-specific fields like <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">likedByViewer</code>.
            </p>
            <CodeBlock code={'Authorization: Bearer pk_live_your_key_here'} />
          </div>

          <div className="flex flex-col gap-1.5">
            <h2 className="font-heading text-lg font-semibold text-foreground">Errors</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Every response is JSON. Successful calls return{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{"{ data }"}</code>; failures return{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{"{ error }"}</code> with a standard
              HTTP status code (400, 401, 403, 404, or 500).
            </p>
            <CodeBlock code={ERROR_EXAMPLE} />
          </div>

          <div className="flex flex-col gap-1.5 rounded-xl border border-dashed border-border p-4">
            <h2 className="font-heading text-sm font-semibold text-foreground">Known gaps</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              There&apos;s no rate limiting yet — build responsibly. Direct
              messages and moderation/admin actions aren&apos;t exposed by
              this API and stay web-app-only.
            </p>
          </div>
        </section>

        <DocsNav groups={API_GROUPS.map((g) => ({ id: g.id, title: g.title }))} />

        <div className="flex flex-col gap-12 pt-8">
          {API_GROUPS.map((group) => (
            <section key={group.id} id={group.id} className="flex flex-col gap-4 scroll-mt-24">
              <div className="flex flex-col gap-1">
                <h2 className="font-heading text-xl font-semibold text-foreground">{group.title}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{group.description}</p>
              </div>
              <div className="flex flex-col gap-4">
                {group.endpoints.map((endpoint) => (
                  <EndpointCard key={`${endpoint.method}-${endpoint.path}`} endpoint={endpoint} />
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
            &copy; {new Date().getFullYear()} Pulse. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  )
}
