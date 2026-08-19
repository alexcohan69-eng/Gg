"use client"

import { useEffect } from "react"
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
 * Error boundary for the root segment (landing page and the auth
 * screens, which live outside the `(app)` group and so aren't covered
 * by its boundary).
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[v0] Root segment error:", error)
  }, [error])

  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-6">
      <Empty className="border-none">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlertIcon />
          </EmptyMedia>
          <EmptyTitle>Something went wrong</EmptyTitle>
          <EmptyDescription>
            We couldn&apos;t load this page. Please try again in a moment.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button className="rounded-full" onClick={reset}>
            <RotateCwIcon data-icon="inline-start" />
            Try again
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}
