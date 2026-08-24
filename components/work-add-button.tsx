"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "lucide-react"
import { PortfolioProjectDialog } from "@/components/portfolio-project-editor"
import { MAX_PROJECTS } from "@/components/portfolio-grid"
import { Button } from "@/components/ui/button"

/**
 * Always-visible "Add project" trigger rendered in the Work tab's sticky
 * header, so owners can start a new case study without first scrolling
 * past the profile card and empty state. Mirrors `PortfolioGrid`'s own
 * add trigger (same dialog, same cap) — that one stays too, as the
 * primary action once the page is scrolled into the grid.
 */
export function WorkAddButton({ projectCount }: { projectCount: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const atLimit = projectCount >= MAX_PROJECTS

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="rounded-full"
        disabled={atLimit}
        onClick={() => setOpen(true)}
        aria-label="Add project"
      >
        <PlusIcon />
      </Button>

      <PortfolioProjectDialog open={open} onOpenChange={setOpen} onSaved={() => router.refresh()} />
    </>
  )
}
