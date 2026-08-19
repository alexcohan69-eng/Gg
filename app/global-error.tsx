"use client"

import { useEffect } from "react"

/**
 * Last-resort boundary that catches errors thrown in the root layout
 * itself. It replaces the whole document, so it can't rely on the app
 * shell, theme provider, or shared components — everything here is
 * self-contained and inline-styled so it renders no matter what failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[v0] Global error:", error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0e0e0f",
          color: "#fbfaf9",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "24rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              lineHeight: 1.6,
              color: "#a1a1aa",
              margin: "0 0 1.5rem",
            }}
          >
            The app hit an unexpected error. Please try reloading — if it keeps
            happening, come back in a little while.
          </p>
          <button
            onClick={reset}
            style={{
              appearance: "none",
              border: "none",
              cursor: "pointer",
              borderRadius: "9999px",
              padding: "0.625rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              backgroundColor: "#f26d5b",
              color: "#0e0e0f",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
