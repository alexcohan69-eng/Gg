"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { RotateCwIcon, TriangleAlertIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty"

/**
 * Segment error boundary for the whole authenticated app. Data here is
 * loaded server-side against Aurora, so a transient database hiccup (or
 * an expired IAM token mid-render) would otherwise surface as an
 * unrecoverable error screen. `reset()` re-renders the segment (a fresh
 * server attempt), and a hard refresh is offered as a fallback.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error("[v0] App segment error:", error)
  }, [error])

  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center p-6">
      <Empty className="border-none">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlertIcon />
          </EmptyMedia>
          <EmptyTitle>Something went wrong</EmptyTitle>
          <EmptyDescription>
            We couldn&apos;t load this page. This is usually temporary — try
            again in a moment.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex items-center gap-2">
            <Button
              className="rounded-full"
              onClick={() => {
                // Refresh server data first, then re-render the segment so
                // a resolved transient failure clears without a full reload.
                router.refresh()
                reset()
              }}
            >
              <RotateCwIcon data-icon="inline-start" />
              Try again
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => window.location.reload()}
            >
              Reload page
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    </div>
  )
}
