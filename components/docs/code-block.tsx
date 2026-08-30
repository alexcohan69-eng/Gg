"use client"

import { useState } from "react"
import { CheckIcon, CopyIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** A read-only code snippet with a copy-to-clipboard button, used throughout the API docs for request/response examples. */
export function CodeBlock({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access can be denied by the browser; the code is still selectable manually.
    }
  }

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border bg-muted/40",
        className,
      )}
    >
      <pre className="overflow-x-auto p-3 pr-10 text-xs leading-relaxed text-foreground">
        <code className="font-mono">{code}</code>
      </pre>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleCopy}
        aria-label="Copy code"
        className="absolute right-1.5 top-1.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        {copied ? <CheckIcon className="text-primary" /> : <CopyIcon />}
      </Button>
    </div>
  )
}
