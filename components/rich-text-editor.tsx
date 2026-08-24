"use client"

import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import {
  BoldIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  CodeIcon,
  StrikethroughIcon,
} from "lucide-react"
import { Toggle } from "@/components/ui/toggle"
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
      className="size-8 rounded-full p-0 text-muted-foreground data-[state=on]:bg-primary/15 data-[state=on]:text-primary"
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
}: {
  editor: Editor | null
  className?: string
}) {
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
}: {
  placeholder?: string
  autofocus?: boolean
  onUpdate?: (editor: Editor) => void
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
