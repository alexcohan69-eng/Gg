"use client"

import { useEffect } from "react"
import { TriangleAlertIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
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
 * Route-level error boundary for the authenticated app. Catches
 * unexpected failures in any in-app page's server render (e.g. a
 * transient Aurora connection blip) so the viewer gets a styled,
 * recoverable screen inside the shell instead of a broken page.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[v0] App route error:", error)
  }, [error])

  return (
    <div className="flex flex-col">
      <PageHeader title="Something went wrong" />
      <div className="p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TriangleAlertIcon />
            </EmptyMedia>
            <EmptyTitle>We couldn&apos;t load this page</EmptyTitle>
            <EmptyDescription>
              Something went wrong on our end. Please try again — if it keeps
              happening, give it a moment and reload.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={reset}>Try again</Button>
          </EmptyContent>
        </Empty>
      </div>
    </div>
  )
}
