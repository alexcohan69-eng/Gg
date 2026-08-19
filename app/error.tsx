"use client"

import { useEffect } from "react"
import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"

/**
 * Segment-level error boundary. Next.js renders this in place of any
 * page/layout that throws during render (e.g. an unexpected error from
 * a `lib/*` query) instead of crashing to a blank screen. Scoped under
 * the root layout, so the app shell chrome around it still renders
 * where possible — this only replaces the failing segment.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[v0] Unhandled error in route segment:", error)
  }, [error])

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-4 py-10 text-center">
      <Logo />
      <div className="flex flex-col items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <TriangleAlertIcon className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
          Something went wrong
        </h1>
        <p className="max-w-sm text-sm text-pretty text-muted-foreground">
          An unexpected error occurred while loading this page. You can try
          again, or head back to your feed.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => reset()} className="rounded-full">
          <RefreshCwIcon data-icon="inline-start" />
          Try again
        </Button>
        <Button
          nativeButton={false}
          render={<a href="/home" />}
          className="rounded-full"
        >
          Go home
        </Button>
      </div>
    </main>
  )
}
