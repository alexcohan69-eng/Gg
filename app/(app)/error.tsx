"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangleIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Error boundary for pages inside the authenticated app shell. This
 * wraps every `(app)/**\/page.tsx` but — per Next.js's error boundary
 * scoping — not `(app)/layout.tsx` itself, so `AppShell` (nav, top
 * bar, tab bar) keeps rendering around this fallback. A query that
 * throws (a bad id in the URL, a transient DB error) degrades to this
 * single page instead of taking down the whole app shell.
 */
export default function AppSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[v0] App segment error:", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangleIcon className="size-6" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
          This page couldn&apos;t load
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Something went wrong fetching this page. Try again, or head back
          home.
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
