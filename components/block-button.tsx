"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { BanIcon, FlagIcon, MoreHorizontalIcon } from "lucide-react"
import { blockUser, unblockUser } from "@/app/actions/blocks"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ReportDialog } from "@/components/report-dialog"
import { cn } from "@/lib/utils"

/**
 * Overflow menu on a profile for the two moderation actions that
 * aren't the primary follow/message affordances: block/unblock and
 * report. Kept as one "..." trigger (mirroring `PostCard`'s options
 * menu) rather than two more buttons crowding the header.
 */
export function BlockButton({
  targetUserId,
  targetUserName,
  profileIdentifier,
  initialIsBlocked,
  className,
}: {
  targetUserId: string
  targetUserName: string
  profileIdentifier: string
  initialIsBlocked: boolean
  className?: string
}) {
  const router = useRouter()
  const [isBlocked, setIsBlocked] = useState(initialIsBlocked)
  const [isPending, startTransition] = useTransition()
  const [reportOpen, setReportOpen] = useState(false)

  function handleToggleBlock() {
    const next = !isBlocked
    startTransition(async () => {
      const result = next
        ? await blockUser(targetUserId, profileIdentifier)
        : await unblockUser(targetUserId, profileIdentifier)

      if (!result.success) {
        toast.error(result.error ?? "Something went wrong.")
        return
      }

      setIsBlocked(next)
      toast.success(next ? `Blocked @${targetUserName}` : `Unblocked @${targetUserName}`)
      router.refresh()
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Profile options"
              disabled={isPending}
              className={cn("rounded-full", className)}
            >
              <MoreHorizontalIcon />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant={isBlocked ? undefined : "destructive"}
            onClick={handleToggleBlock}
            disabled={isPending}
          >
            <BanIcon data-icon="inline-start" />
            {isBlocked ? "Unblock" : "Block"}
          </DropdownMenuItem>
          {!isBlocked ? (
            <DropdownMenuItem onClick={() => setReportOpen(true)}>
              <FlagIcon data-icon="inline-start" />
              Report user
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        target={{ type: "user", id: targetUserId, name: targetUserName }}
      />
    </>
  )
}
