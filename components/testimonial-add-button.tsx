"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "lucide-react"
import { TestimonialDialog } from "@/components/testimonial-editor"
import { MAX_TESTIMONIALS } from "@/components/testimonial-grid"
import { Button } from "@/components/ui/button"

/**
 * Always-visible "Add testimonial" trigger rendered in the
 * Testimonials tab's sticky header, so owners can start a new quote
 * without first scrolling past the profile card and empty state.
 * Mirrors ServiceAddButton/WorkAddButton — same dialog, same cap.
 */
export function TestimonialAddButton({
  testimonialCount,
  serviceOptions = [],
  projectOptions = [],
}: {
  testimonialCount: number
  serviceOptions?: { id: string; title: string }[]
  projectOptions?: { id: string; title: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const atLimit = testimonialCount >= MAX_TESTIMONIALS

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="rounded-full"
        disabled={atLimit}
        onClick={() => setOpen(true)}
        aria-label="Add testimonial"
      >
        <PlusIcon />
      </Button>

      <TestimonialDialog
        open={open}
        onOpenChange={setOpen}
        onSaved={() => router.refresh()}
        serviceOptions={serviceOptions}
        projectOptions={projectOptions}
      />
    </>
  )
}
