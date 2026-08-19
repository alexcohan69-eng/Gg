"use client"

import { useEffect } from "react"

/**
 * Last-resort error boundary: only triggers when the root layout
 * itself throws (so `app/error.tsx` isn't mounted to catch it). Must
 * render its own <html>/<body> since it replaces the root layout
 * entirely. Kept deliberately plain/inline-styled — it can't rely on
 * globals.css or any provider (theme, fonts) that may be the very
 * thing that failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[v0] Unhandled error in root layout:", error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem",
          padding: "2.5rem 1rem",
          textAlign: "center",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          backgroundColor: "#0e0e0f",
          color: "#fbfaf9",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#a1a1aa", maxWidth: "26rem", margin: 0 }}>
            Pulse hit an unexpected error and couldn&apos;t load. Try again, or
            reload the page.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              borderRadius: "9999px",
              padding: "0.5rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              border: "1px solid #3f3f46",
              background: "transparent",
              color: "#fbfaf9",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <a
            href="/home"
            style={{
              borderRadius: "9999px",
              padding: "0.5rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              background: "#fbfaf9",
              color: "#0e0e0f",
              textDecoration: "none",
            }}
          >
            Go home
          </a>
        </div>
      </body>
    </html>
  )
}
