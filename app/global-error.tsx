"use client"

import { useEffect } from "react"
import "./globals.css"

/**
 * Last-resort boundary for errors thrown in the root layout itself.
 * It replaces the entire document, so it must render its own
 * <html>/<body> and can't rely on the app's providers. Kept minimal
 * and self-contained on purpose.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[v0] Root error:", error)
  }, [error])

  return (
    <html lang="en" className="bg-background">
      <body className="antialiased">
        <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-lg font-semibold text-foreground">
            Something went wrong
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            An unexpected error occurred. Please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
