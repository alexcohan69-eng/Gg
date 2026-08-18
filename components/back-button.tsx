"use client"

import { useRouter } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Icon-only back button for detail pages, e.g. the post thread view. */
export function BackButton() {
  const router = useRouter()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="shrink-0 rounded-full"
      aria-label="Go back"
      onClick={() => router.back()}
    >
      <ArrowLeftIcon />
    </Button>
  )
}
