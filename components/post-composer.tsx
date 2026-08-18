"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createPost } from "@/app/actions/posts"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { cn, getInitials } from "@/lib/utils"

const MAX_POST_LENGTH = 280

export function PostComposer({
  user,
  replyToId,
  placeholder = "What's happening?",
  submitLabel = "Post",
  autoFocus = false,
  onPosted,
}: {
  user: { name: string; image?: string | null }
  /** When set, the created post is a reply to this post id. */
  replyToId?: string
  placeholder?: string
  submitLabel?: string
  autoFocus?: boolean
  /** Called after a successful post, e.g. to refocus or scroll a list. */
  onPosted?: () => void
}) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [content, setContent] = useState("")
  const [isPending, startTransition] = useTransition()

  const remaining = MAX_POST_LENGTH - content.length
  const isEmpty = content.trim().length === 0
  const isOverLimit = remaining < 0

  function handleSubmit(formData: FormData) {
    if (replyToId) {
      formData.set("replyToId", replyToId)
    }

    startTransition(async () => {
      const result = await createPost(formData)
      if (!result.success) {
        toast.error(result.error ?? "Something went wrong. Try again.")
        return
      }
      setContent("")
      formRef.current?.reset()
      onPosted?.()
      router.refresh()
    })
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="flex gap-3 border-b border-border p-4"
    >
      <Avatar className="size-10 shrink-0">
        <AvatarImage src={user.image ?? undefined} alt={user.name} />
        <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
      </Avatar>

      <div className="flex flex-1 flex-col gap-3">
        <Textarea
          name="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          aria-label={replyToId ? "Reply content" : "Post content"}
          rows={replyToId ? 3 : 2}
          autoFocus={autoFocus}
          className="border-none px-0 py-1 text-lg focus-visible:ring-0"
          disabled={isPending}
        />
        <div className="flex items-center justify-end gap-3">
          <span
            className={cn(
              "text-xs text-muted-foreground",
              isOverLimit && "font-medium text-destructive",
            )}
            aria-live="polite"
          >
            {remaining}
          </span>
          <Button
            type="submit"
            className="rounded-full"
            disabled={isEmpty || isOverLimit || isPending}
          >
            {isPending ? <Spinner data-icon="inline-start" /> : null}
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  )
}
