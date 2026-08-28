"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { KeyRound, Trash2, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type ApiKey = {
  id: string
  name: string
  keyPrefix: string
  lastUsedAt: string | null
  createdAt: string
  revokedAt: string | null
}

/**
 * Client-driven settings panel that talks to the real public API
 * (`/api/v1/api-keys`) rather than a Server Action — this is
 * deliberately "dogfooding" the same REST surface third-party
 * developers use, authenticated here via the existing browser
 * session (see `requireApiUser`).
 */
export function ApiKeysManager({ initialKeys }: { initialKeys: ApiKey[] }) {
  const [keys, setKeys] = useState(initialKeys.filter((k) => !k.revokedAt))
  const [name, setName] = useState("")
  const [newRawKey, setNewRawKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null)
  const [isCreating, startCreating] = useTransition()
  const [isRevoking, startRevoking] = useTransition()

  function handleCreate() {
    if (!name.trim()) {
      toast.error("Give this key a name, e.g. 'My integration'.")
      return
    }
    startCreating(async () => {
      const res = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error?.message ?? "Failed to create key")
        return
      }
      setKeys((prev) => [
        {
          id: json.data.id,
          name: json.data.name,
          keyPrefix: json.data.keyPrefix,
          lastUsedAt: null,
          createdAt: json.data.createdAt,
          revokedAt: null,
        },
        ...prev,
      ])
      setNewRawKey(json.data.key)
      setName("")
    })
  }

  function handleRevoke() {
    if (!revokeTarget) return
    const target = revokeTarget
    startRevoking(async () => {
      const res = await fetch(`/api/v1/api-keys/${target.id}`, { method: "DELETE" })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error(json.error?.message ?? "Failed to revoke key")
        return
      }
      setKeys((prev) => prev.filter((k) => k.id !== target.id))
      toast.success("Key revoked")
      setRevokeTarget(null)
    })
  }

  async function handleCopy() {
    if (!newRawKey) return
    await navigator.clipboard.writeText(newRawKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-4">
      {newRawKey ? (
        <div className="flex flex-col gap-2 rounded-md border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm font-medium">Copy your new key now</p>
          <p className="text-xs text-muted-foreground">
            This is the only time it will be shown. Store it securely.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs">{newRawKey}</code>
            <Button size="icon" variant="outline" onClick={handleCopy} aria-label="Copy API key">
              {copied ? <Check className="text-primary" /> : <Copy />}
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="w-fit" onClick={() => setNewRawKey(null)}>
            Done
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Key name, e.g. My integration"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            disabled={isCreating}
          />
          <Button onClick={handleCreate} disabled={isCreating} className="shrink-0">
            {isCreating ? <Spinner data-icon="inline-start" /> : <KeyRound data-icon="inline-start" />}
            Generate key
          </Button>
        </div>
      )}

      {keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">No API keys yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {keys.map((key) => (
            <li
              key={key.id}
              className="flex items-center justify-between gap-3 rounded-md border p-3"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{key.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{key.keyPrefix}...</span>
                <span className="text-xs text-muted-foreground">
                  {key.lastUsedAt
                    ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                    : "Never used"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Revoke ${key.name}`}
                onClick={() => setRevokeTarget(key)}
              >
                <Trash2 className="text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={revokeTarget !== null} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke &quot;{revokeTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Any application using this key will immediately lose access. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke} disabled={isRevoking}>
              {isRevoking ? <Spinner data-icon="inline-start" /> : null}
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
