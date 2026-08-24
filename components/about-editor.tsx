"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { updateAbout } from "@/app/actions/profile"
import { useRichTextEditor, RichTextEditor, RichTextToolbar } from "@/components/rich-text-editor"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { isHtmlContentEmpty } from "@/lib/sanitize-html"
import { cn } from "@/lib/utils"

const MAX_ABOUT_LENGTH = 4000

/**
 * Rich-text editor for the profile's About section. Separate from the
 * short one-line `bio` field on the main profile form — this is the
 * longer, formatted write-up (background, specialties, etc.) rendered
 * on the About page.
 */
export function AboutEditor({ about }: { about: string | null }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  const editor = useRichTextEditor({
    placeholder: "Share your background, specialties, and what makes you unique...",
    onUpdate: () => setIsDirty(true),
  })

  // Editor is created client-side only (immediatelyRender: false), so
  // hydrate its content imperatively rather than via a prop.
  const [hasHydrated, setHasHydrated] = useState(false)
  if (editor && !hasHydrated) {
    editor.commands.setContent(about ?? "")
    setHasHydrated(true)
  }

  function handleSave() {
    if (!editor) return
    setError(null)

    const html = editor.getHTML()
    if (!isHtmlContentEmpty(html) && html.replace(/<[^>]+>/g, "").length > MAX_ABOUT_LENGTH) {
      setError(`About section must be ${MAX_ABOUT_LENGTH} characters or fewer.`)
      return
    }

    startTransition(async () => {
      const result = await updateAbout(html)
      if (!result.success) {
        setError(result.error ?? "Something went wrong. Try again.")
        return
      }
      setIsDirty(false)
      toast.success("About section updated")
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          "rounded-lg border bg-background transition-colors",
          error ? "border-destructive" : "border-input focus-within:border-ring",
        )}
      >
        <RichTextEditor editor={editor} className="px-3 pt-3" />
        <RichTextToolbar
          editor={editor}
          className="border-t px-2 py-1.5"
        />
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} disabled={isPending || !isDirty}>
          {isPending ? <Spinner data-icon="inline-start" /> : null}
          Save changes
        </Button>
      </div>
    </div>
  )
}
