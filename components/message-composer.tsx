"use client"

import { useRef, useState, useTransition, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { SendIcon } from "lucide-react"
import { sendMessage } from "@/app/actions/messages"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"

const MAX_MESSAGE_LENGTH = 2000

export function MessageComposer({ conversationId }: { conversationId: string }) {
  const router = useRouter()
  const [content, setContent] = useState("")
  const [isPending, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isEmpty = content.trim().length === 0
  const isOverLimit = content.length > MAX_MESSAGE_LENGTH

  function submit() {
    if (isEmpty || isOverLimit || isPending) return
    const value = content.trim()

    startTransition(async () => {
      const result = await sendMessage(conversationId, value)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setContent("")
      router.refresh()
      textareaRef.current?.focus()
    })
  }

  // Enter sends, Shift+Enter adds a newline. CJK IMEs use Enter to
  // confirm composition, so a plain Enter mid-composition must not
  // trigger a send — isComposing (and Safari's unreliable keyCode 229)
  // covers that.
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing &&
      event.keyCode !== 229
    ) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className="flex items-end gap-2 border-t border-border p-3"
    >
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Write a message"
        aria-label="Message"
        rows={1}
        maxLength={MAX_MESSAGE_LENGTH + 1}
        disabled={isPending}
        className="max-h-40 min-h-10 rounded-2xl"
        autoFocus
      />
      <Button
        type="submit"
        size="icon"
        className="shrink-0 rounded-full"
        aria-label="Send message"
        disabled={isEmpty || isOverLimit || isPending}
      >
        {isPending ? <Spinner /> : <SendIcon />}
      </Button>
    </form>
  )
}
