"use client"

import { useEffect, useState } from "react"
import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import TiptapImage from "@tiptap/extension-image"
import {
  BoldIcon,
  ImagePlusIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  CodeIcon,
  StrikethroughIcon,
} from "lucide-react"
import { Toggle } from "@/components/ui/toggle"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

function ToolbarButton({
  active,
  disabled,
  label,
  onClick,
  children,
}: {
  active?: boolean
  disabled?: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Toggle
      size="sm"
      pressed={active}
      disabled={disabled}
      aria-label={label}
      onPressedChange={onClick}
      // Formatting applies to the current selection, so the toolbar
      // button shouldn't steal focus away from the editor when clicked —
      // this also stops the click from firing a spurious editor "blur"
      // that callers (e.g. the post composer) may use to collapse their UI.
      onMouseDown={(e) => e.preventDefault()}
      className="size-8 rounded-full p-0 text-muted-foreground transition-colors data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm data-[state=on]:brightness-90 data-[state=on]:saturate-150"
    >
      {children}
    </Toggle>
  )
}

/** Formatting toolbar shown above the editor. Rendered separately from
 * the editor surface so the composer can pin it to the bottom (Twitter/X
 * style) while other callers keep it directly above the text area. */
export function RichTextToolbar({
  editor,
  className,
  onInsertImage,
  insertingImage = false,
}: {
  editor: Editor | null
  className?: string
  /**
   * When provided, renders an "Insert image" button that calls this
   * instead of a formatting command — the caller owns the actual file
   * picker/upload (e.g. the portfolio editor's inline description
   * images) and inserts the result with `editor.chain().focus().setImage(...)`.
   * Omitted entirely by callers (like the post composer) that don't
   * support inline images.
   */
  onInsertImage?: () => void
  /** Shows a spinner on the insert-image button while an upload is in flight. */
  insertingImage?: boolean
}) {
  // `editor.isActive(...)` below is imperative — Tiptap doesn't re-render
  // React on its own, so without this the toolbar only ever reflects
  // whatever was active the last time *content* changed (`onUpdate`), not
  // when the cursor moves into/out of bold, italic, etc. Bumping a tick on
  // every selection change and transaction (mark toggles, formatting
  // commands) forces this component to re-render so the pressed button
  // always matches the format under the cursor.
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!editor) return
    const rerender = () => setTick((t) => t + 1)
    editor.on("selectionUpdate", rerender)
    editor.on("transaction", rerender)
    return () => {
      editor.off("selectionUpdate", rerender)
      editor.off("transaction", rerender)
    }
  }, [editor])

  if (!editor) return null

  // Narrow into a local const: TypeScript doesn't retain the `!editor`
  // guard above across the `toggleLink` closure since `editor` is a
  // function parameter, not a `const`.
  const activeEditor = editor

  function toggleLink() {
    const previousUrl = activeEditor.getAttributes("link").href as string | undefined
    const url = window.prompt("Link URL", previousUrl ?? "https://")
    if (url === null) return
    if (url.trim() === "") {
      activeEditor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    activeEditor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run()
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-0.5 text-muted-foreground",
        className,
      )}
      role="toolbar"
      aria-label="Formatting"
    >
      <ToolbarButton
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <BoldIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <ItalicIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <StrikethroughIcon />
      </ToolbarButton>
      <ToolbarButton label="Link" active={editor.isActive("link")} onClick={toggleLink}>
        <LinkIcon />
      </ToolbarButton>
      {onInsertImage ? (
        <ToolbarButton
          label="Insert image"
          disabled={insertingImage}
          onClick={onInsertImage}
        >
          {insertingImage ? <Spinner className="size-4" /> : <ImagePlusIcon />}
        </ToolbarButton>
      ) : null}
      <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
      <ToolbarButton
        label="Bulleted list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <ListIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrderedIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <QuoteIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Code"
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <CodeIcon />
      </ToolbarButton>
    </div>
  )
}

export function useRichTextEditor({
  placeholder,
  autofocus = false,
  onUpdate,
  images = false,
}: {
  placeholder?: string
  autofocus?: boolean
  onUpdate?: (editor: Editor) => void
  /**
   * Enables Tiptap's Image node so `editor.chain().focus().setImage(...)`
   * can insert an inline image anywhere in the description — used by
   * the portfolio case-study editor, off by default for callers (like
   * the post composer) that don't support inline images.
   */
  images?: boolean
}) {
  const editor = useEditor({
    immediatelyRender: false,
    autofocus,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        horizontalRule: false,
        link: {
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
        },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      ...(images
        ? [
            TiptapImage.configure({
              HTMLAttributes: { class: "max-w-full rounded-lg" },
            }),
          ]
        : []),
    ],
    editorProps: {
      attributes: {
        class:
          "prose-post min-h-[3rem] w-full text-pretty break-words text-foreground focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => onUpdate?.(editor),
  })

  return editor
}

/** Bare editor surface (no toolbar) — composed with `RichTextToolbar` by callers. */
export function RichTextEditor({
  editor,
  className,
}: {
  editor: Editor | null
  className?: string
}) {
  return <EditorContent editor={editor} className={className} />
}
