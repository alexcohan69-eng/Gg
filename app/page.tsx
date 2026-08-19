import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { House, MessageCircle, Bell, Users } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"

// The one page on Pulse that's actually meant to be found via search —
// everything past sign-in is a private feed. Opts back in to indexing
// against the root layout's default `robots: { index: false }`.
export const metadata: Metadata = {
  robots: { index: true, follow: true },
}

const FEATURES = [
  {
    icon: House,
    title: "One focused feed",
    description:
      "Follow the people and ideas you care about. No noise, no algorithmic guessing games.",
  },
  {
    icon: MessageCircle,
    title: "Real conversations",
    description:
      "Reply, quote, and build threads that actually read like a conversation.",
  },
  {
    icon: Bell,
    title: "Know the moment it happens",
    description:
      "Likes, replies, and new followers land in one clean notification center.",
  },
  {
    icon: Users,
    title: "Built for community",
    description:
      "Public profiles, follower graphs, and direct messages — the essentials, done well.",
  },
]

export default async function LandingPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect("/home")

  return (
    <main className="min-h-svh bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href="/sign-in" />}
          >
            Sign in
          </Button>
          <Button nativeButton={false} render={<Link href="/sign-up" />}>
            Get started
          </Button>
        </nav>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <Image
            src="/images/hero-network.png"
            alt=""
            fill
            priority
            className="object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/10" />
        </div>

        <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-6 py-24 text-center sm:py-32">
          <h1 className="max-w-3xl font-heading text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-6xl">
            Say it. Share it. Feel the pulse.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-pretty text-muted-foreground">
            Pulse is a fast, focused social feed for real-time thoughts,
            threads, and the conversations that matter to you.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              className="px-8"
              nativeButton={false}
              render={<Link href="/sign-up" />}
            >
              Create your account
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="px-8"
              nativeButton={false}
              render={<Link href="/sign-in" />}
            >
              Sign in
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="flex flex-col gap-3">
              <div className="flex size-11 items-center justify-center rounded-full bg-accent">
                <feature.icon
                  className="size-5 text-accent-foreground"
                  aria-hidden="true"
                />
              </div>
              <h2 className="font-heading text-lg font-semibold text-foreground">
                {feature.title}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <Logo className="text-base" />
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Pulse. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  )
}
