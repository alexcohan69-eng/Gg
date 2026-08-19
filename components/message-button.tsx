"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { MailIcon } from "lucide-react"
import { startConversation } from "@/app/actions/messages"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

/** Starts (or resumes) a conversation with a profile and navigates to it. */
export function MessageButton({
  targetUserId,
  className,
}: {
  targetUserId: string
  className?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const result = await startConversation(targetUserId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      router.push(`/messages/${result.data.conversationId}`)
    })
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Message"
      disabled={isPending}
      onClick={handleClick}
      className={cn("rounded-full", className)}
    >
      {isPending ? <Spinner /> : <MailIcon />}
    </Button>
  )
}
