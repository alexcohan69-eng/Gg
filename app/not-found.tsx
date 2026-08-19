import Link from "next/link"
import { CompassIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"

/**
 * Root-level 404, for any URL that doesn't match a route at all (a
 * typo'd path, a stale bookmark, etc). Scoped not-found pages already
 * exist for post/[id] and profile/[username] to cover "resource
 * doesn't exist" specifically; this covers everything else.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-4 py-10 text-center">
      <Logo />
      <div className="flex flex-col items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <CompassIcon className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
          Page not found
        </h1>
        <p className="max-w-sm text-sm text-pretty text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist, or the link is
          incorrect.
        </p>
      </div>
      <Button nativeButton={false} render={<Link href="/home" />} className="rounded-full">
        Go home
      </Button>
    </main>
  )
}
