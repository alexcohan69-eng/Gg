"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangleIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Root-level error boundary. Catches anything that throws above (or
 * outside) a page's own error boundary — most notably the session +
 * badge-count fetch in `(app)/layout.tsx`, since a segment's
 * `error.tsx` never covers its own `layout.tsx` (only its page and
 * children). A transient Aurora connection blip surfaces here as a
 * friendly retry screen instead of Next's default crash page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[v0] Unhandled error:", error)
  }, [error])

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangleIcon className="size-7" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
          Something went wrong
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          We hit an unexpected error loading Pulse. This is usually
          temporary — try again in a moment.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={reset} className="rounded-full">
          Try again
        </Button>
        <Button
          variant="outline"
          className="rounded-full"
          nativeButton={false}
          render={<Link href="/home" />}
        >
          Go home
        </Button>
      </div>
    </div>
  )
}
