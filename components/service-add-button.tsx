"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "lucide-react"
import { ServiceDialog } from "@/components/service-editor"
import { MAX_SERVICES } from "@/components/service-grid"
import { Button } from "@/components/ui/button"

/**
 * Always-visible "Add service" trigger rendered in the Services tab's
 * sticky header, so owners can start a new listing without first
 * scrolling past the profile card and empty state. Mirrors
 * WorkAddButton — same dialog, same cap. The grid's own add trigger
 * stays too, as the primary action once the page is scrolled in.
 */
export function ServiceAddButton({ serviceCount }: { serviceCount: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const atLimit = serviceCount >= MAX_SERVICES

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="rounded-full"
        disabled={atLimit}
        onClick={() => setOpen(true)}
        aria-label="Add service"
      >
        <PlusIcon />
      </Button>

      <ServiceDialog open={open} onOpenChange={setOpen} onSaved={() => router.refresh()} />
    </>
  )
}
