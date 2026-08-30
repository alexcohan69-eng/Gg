"use client"

import { useState, useTransition } from "react"
import { CheckIcon, CopyIcon, SendIcon, UnlinkIcon } from "lucide-react"
import { toast } from "sonner"
import {
  startBuiltinTelegramLink,
  startCustomTelegramLink,
  confirmTelegramCode,
  unlinkTelegram,
  sendTestTelegramMessage,
  type TelegramLinkSummary,
} from "@/app/actions/telegram"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
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
import { Badge } from "@/components/ui/badge"

/** Shown once a link (built-in or custom) has captured a chat id and is waiting for the code. */
function VerifyCodeForm({ onVerified }: { onVerified: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await confirmTelegramCode(formData)
      if (!result.success) {
        setError(result.error)
        return
      }
      toast.success("Telegram connected")
      onVerified()
    })
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="code">Verification code</FieldLabel>
          <FieldDescription>Check the message the bot sent you and enter the 6-digit code.</FieldDescription>
          <Input id="code" name="code" inputMode="numeric" maxLength={6} placeholder="123456" required autoFocus />
        </Field>
      </FieldGroup>
      {error ? <FieldError>{error}</FieldError> : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? <Spinner data-icon="inline-start" /> : null}
        Confirm code
      </Button>
    </form>
  )
}

function BuiltinLinkFlow({ onPending }: { onPending: () => void }) {
  const [deepLink, setDeepLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)

  function handleStart() {
    setError(null)
    startTransition(async () => {
      const result = await startBuiltinTelegramLink()
      if (!result.success) {
        setError(result.error)
        return
      }
      setDeepLink(result.deepLink)
    })
  }

  async function handleCopy() {
    if (!deepLink) return
    await navigator.clipboard.writeText(deepLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!deepLink) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Use the Web Banai bot — no setup required. Tap the link below, press Start in Telegram, then come back here
          to enter the code it sends you.
        </p>
        {error ? <FieldError>{error}</FieldError> : null}
        <Button type="button" onClick={handleStart} disabled={isPending}>
          {isPending ? <Spinner data-icon="inline-start" /> : null}
          Get link
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Open this link, then press <strong>Start</strong> in Telegram:
        </p>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
          <a
            href={deepLink}
            target="_blank"
            rel="noreferrer"
            className="flex-1 overflow-x-auto text-sm text-foreground underline underline-offset-2"
          >
            {deepLink}
          </a>
          <Button type="button" variant="outline" size="icon-sm" onClick={handleCopy} aria-label="Copy link">
            {copied ? <CheckIcon /> : <CopyIcon />}
          </Button>
        </div>
      </div>
      <VerifyCodeForm onVerified={onPending} />
    </div>
  )
}

function CustomLinkFlow({ onPending }: { onPending: () => void }) {
  const [awaitingCode, setAwaitingCode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await startCustomTelegramLink(formData)
      if (!result.success) {
        setError(result.error)
        return
      }
      toast.success(`Connected to @${result.botUsername} — check the chat for your code.`)
      setAwaitingCode(true)
    })
  }

  if (awaitingCode) {
    return <VerifyCodeForm onVerified={onPending} />
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Create a bot with{" "}
        <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="underline underline-offset-2">
          @BotFather
        </a>{" "}
        to get a token, then message your new bot (or add it to a group) and grab that chat&apos;s ID from{" "}
        <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="underline underline-offset-2">
          @userinfobot
        </a>
        .
      </p>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="botToken">Bot token</FieldLabel>
          <Input id="botToken" name="botToken" type="password" placeholder="123456:ABC-DEF..." required autoComplete="off" />
        </Field>
        <Field>
          <FieldLabel htmlFor="chatId">Chat ID</FieldLabel>
          <Input id="chatId" name="chatId" placeholder="e.g. 123456789" required />
        </Field>
      </FieldGroup>
      {error ? <FieldError>{error}</FieldError> : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? <Spinner data-icon="inline-start" /> : null}
        Connect bot
      </Button>
    </form>
  )
}

function LinkedState({ link, onUnlinked }: { link: TelegramLinkSummary; onUnlinked: () => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isTesting, startTestTransition] = useTransition()

  function handleUnlink() {
    startTransition(async () => {
      await unlinkTelegram()
      toast.success("Telegram disconnected")
      setConfirmOpen(false)
      onUnlinked()
    })
  }

  function handleTest() {
    startTestTransition(async () => {
      const result = await sendTestTelegramMessage()
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success("Test message sent — check Telegram.")
    })
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">
            {link.kind === "builtin" ? "Web Banai bot" : `@${link.botUsername}`}
          </p>
          <p className="text-xs text-muted-foreground">Chat ID: {link.chatId ?? "unknown"}</p>
        </div>
        <Badge variant="secondary">Connected</Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={handleTest} disabled={isTesting}>
          {isTesting ? <Spinner data-icon="inline-start" /> : <SendIcon data-icon="inline-start" />}
          Send test message
        </Button>
        <Button type="button" variant="outline" onClick={() => setConfirmOpen(true)}>
          <UnlinkIcon data-icon="inline-start" />
          Unlink
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink this bot?</AlertDialogTitle>
            <AlertDialogDescription>
              It will immediately lose access to manage your account. You can link a bot again anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={handleUnlink}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? <Spinner data-icon="inline-start" /> : null}
              Unlink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function TelegramLinkManager({ initialLink }: { initialLink: TelegramLinkSummary | null }) {
  const [link, setLink] = useState(initialLink)

  function refresh() {
    // The server actions already revalidate the page; re-fetch here
    // so the client state flips immediately instead of waiting on a
    // navigation. A full reload of this small summary is cheap.
    window.location.reload()
  }

  if (link?.isVerified) {
    return <LinkedState link={link} onUnlinked={() => setLink(null)} />
  }

  if (link && !link.isVerified && link.hasPendingCode) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          We sent a verification code to your {link.kind === "builtin" ? "Telegram chat" : `bot (@${link.botUsername})`}.
          Enter it below to finish connecting.
        </p>
        <VerifyCodeForm onVerified={refresh} />
      </div>
    )
  }

  return (
    <Tabs defaultValue="builtin">
      <TabsList>
        <TabsTrigger value="builtin">Web Banai bot</TabsTrigger>
        <TabsTrigger value="custom">Your own bot</TabsTrigger>
      </TabsList>
      <TabsContent value="builtin" className="pt-4">
        <BuiltinLinkFlow onPending={refresh} />
      </TabsContent>
      <TabsContent value="custom" className="pt-4">
        <CustomLinkFlow onPending={refresh} />
      </TabsContent>
    </Tabs>
  )
}
