"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import { SearchIcon, SearchXIcon } from "lucide-react"
import { searchMessageableUsers, startConversation } from "@/app/actions/messages"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"
import { getInitials } from "@/lib/utils"

const DEBOUNCE_MS = 300

function useDebouncedValue(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

function ResultsSkeleton() {
  return (
    <div
      className="flex flex-col divide-y divide-border"
      role="status"
      aria-label="Searching"
    >
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 p-4">
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3.5 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Search-by-name/username picker for starting a new conversation.
 * Reuses the same `searchUsers` query the Explore page runs (minus
 * the viewer's own account), but rows here start a conversation
 * instead of linking to a profile.
 */
export function NewConversationSearch() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS)
  const trimmedQuery = debouncedQuery.trim()

  const { data: results, isLoading } = useSWR(
    trimmedQuery ? ["messageable-users", trimmedQuery] : null,
    ([, term]) => searchMessageableUsers(term),
  )

  const hasQuery = query.trim().length > 0
  const isSearching = hasQuery && trimmedQuery.length > 0 && isLoading
  const showNoResults =
    hasQuery && trimmedQuery.length > 0 && !isSearching && results && results.length === 0

  function handleSelect(userId: string) {
    if (pendingUserId) return
    setPendingUserId(userId)

    startTransition(async () => {
      const result = await startConversation(userId)
      if (!result.success) {
        toast.error(result.error)
        setPendingUserId(null)
        return
      }
      router.push(`/messages/${result.data.conversationId}`)
    })
  }

  return (
    <div className="flex flex-col">
      <div className="p-4">
        <div className="relative max-w-md">
          <SearchIcon
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people to message"
            className="h-10 pl-9"
            aria-label="Search people to message"
            autoComplete="off"
            autoFocus
          />
        </div>
      </div>

      {!hasQuery ? (
        <div className="p-4">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchIcon />
              </EmptyMedia>
              <EmptyTitle>Find someone to message</EmptyTitle>
              <EmptyDescription>
                Search by name or username to start a new conversation.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : isSearching ? (
        <ResultsSkeleton />
      ) : showNoResults ? (
        <div className="p-4">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchXIcon />
              </EmptyMedia>
              <EmptyTitle>No results for &quot;{trimmedQuery}&quot;</EmptyTitle>
              <EmptyDescription>Try a different name or username.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : results && results.length > 0 ? (
        <ul className="flex flex-col">
          {results.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                onClick={() => handleSelect(user.id)}
                disabled={pendingUserId !== null}
                className="flex w-full items-center gap-3 border-b border-border p-4 text-left transition-colors hover:bg-accent/50 disabled:opacity-60"
              >
                <Avatar className="size-11 shrink-0">
                  <AvatarImage src={user.image ?? undefined} alt={user.name} />
                  <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {user.name}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">
                    @{user.username ?? "user"}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
