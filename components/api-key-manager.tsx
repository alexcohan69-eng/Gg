"use client"

import { useState, useTransition } from "react"
import { CheckIcon, CopyIcon, KeyIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { generateApiKey, revokeMyApiKey } from "@/app/actions/api-keys"
import type { ApiKeySummary } from "@/lib/api-keys"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import { Spinner } from "@/components/ui/spinner"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"

const MAX_KEYS = 20

function formatDate(date: Date | null): string {
  if (!date) return "Never"
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

/** Shown exactly once, right after a key is created — the raw secret never appears again after this dialog closes. */
function RevealKeyDialog({
  rawKey,
  onClose,
}: {
  rawKey: string | null
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(rawKey ?? "")
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Couldn't copy. Select and copy the key manually.")
    }
  }

  return (
    <Dialog open={rawKey !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your new API key</DialogTitle>
          <DialogDescription>
            Copy this now — for your security, we won&apos;t show it again.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
          <code className="flex-1 overflow-x-auto text-sm text-foreground">{rawKey}</code>
          <Button type="button" variant="outline" size="icon-sm" onClick={handleCopy} aria-label="Copy key">
            {copied ? <CheckIcon /> : <CopyIcon />}
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateKeyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (key: ApiKeySummary, rawKey: string) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await generateApiKey(formData)
      if (!result.success) {
        setError(result.error)
        return
      }
      onCreated(result.key, result.rawKey)
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create API key</DialogTitle>
          <DialogDescription>
            Name it after what will use it, e.g. &quot;My Discord bot&quot;.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input id="name" name="name" placeholder="My Discord bot" maxLength={60} required autoFocus />
            </Field>
          </FieldGroup>
          {error ? <FieldError>{error}</FieldError> : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner data-icon="inline-start" /> : null}
              Create key
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function KeyRow({ apiKey, onRevoked }: { apiKey: ApiKeySummary; onRevoked: (id: string) => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const isRevoked = apiKey.revokedAt !== null

  function handleRevoke() {
    startTransition(async () => {
      const result = await revokeMyApiKey(apiKey.id)
      if (!result.success) {
        toast.error(result.error ?? "Couldn't revoke key. Try again.")
        return
      }
      toast.success("Key revoked")
      setConfirmOpen(false)
      onRevoked(apiKey.id)
    })
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div className="flex items-center gap-3 min-w-0">
        <KeyIcon className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{apiKey.name}</p>
          <p className="font-mono text-xs text-muted-foreground">pk_live_••••••••{apiKey.keyPreview}</p>
          <p className="text-xs text-muted-foreground">
            {isRevoked
              ? `Revoked ${formatDate(apiKey.revokedAt)}`
              : `Created ${formatDate(apiKey.createdAt)} · Last used ${formatDate(apiKey.lastUsedAt)}`}
          </p>
        </div>
      </div>
      {!isRevoked ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setConfirmOpen(true)}
          aria-label="Revoke key"
        >
          <Trash2Icon />
        </Button>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this key?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{apiKey.name}&quot; will stop working immediately for any app or tool
              using it. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={handleRevoke}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? <Spinner data-icon="inline-start" /> : null}
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}

export function ApiKeyManager({ initialKeys }: { initialKeys: ApiKeySummary[] }) {
  const [keys, setKeys] = useState(initialKeys)
  const [createOpen, setCreateOpen] = useState(false)
  const [revealedKey, setRevealedKey] = useState<string | null>(null)

  const activeCount = keys.filter((k) => !k.revokedAt).length

  function handleCreated(key: ApiKeySummary, rawKey: string) {
    setKeys((prev) => [key, ...prev])
    setRevealedKey(rawKey)
  }

  function handleRevoked(id: string) {
    setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, revokedAt: new Date() } : k)))
  }

  return (
    <div className="flex flex-col gap-4">
      {keys.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <KeyIcon />
            </EmptyMedia>
            <EmptyTitle>No API keys yet</EmptyTitle>
            <EmptyDescription>
              Create a key to start building your own tools against the Web Banai API.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {keys.map((key) => (
            <KeyRow key={key.id} apiKey={key} onRevoked={handleRevoked} />
          ))}
        </ul>
      )}

      <div>
        <Button type="button" variant="outline" onClick={() => setCreateOpen(true)} disabled={activeCount >= MAX_KEYS}>
          <PlusIcon data-icon="inline-start" />
          Create key
        </Button>
      </div>

      <CreateKeyDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={handleCreated} />
      <RevealKeyDialog rawKey={revealedKey} onClose={() => setRevealedKey(null)} />
    </div>
  )
}
