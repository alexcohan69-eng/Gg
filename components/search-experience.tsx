"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { SearchIcon, SearchXIcon, UsersIcon } from "lucide-react"
import { search } from "@/app/actions/search"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { UserListItem } from "@/components/user-list-item"
import { PostCard } from "@/components/post-card"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"

const DEBOUNCE_MS = 300

function useDebouncedValue(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b border-border bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  )
}

function ResultsSkeleton() {
  return (
    <div
      className="flex flex-col divide-y divide-border"
      role="status"
      aria-label="Searching"
    >
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-start gap-3 p-4">
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3.5 w-48" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SearchExperience({
  currentUserId,
  discover,
}: {
  currentUserId: string
  /**
   * Rendered in place of the plain "find people and posts" prompt
   * while the query is empty — e.g. trending posts / suggested users.
   * Search behavior itself (debounce, results, no-results, loading)
   * is unaffected by this prop.
   */
  discover?: React.ReactNode
}) {
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS)
  const trimmedQuery = debouncedQuery.trim()

  const { data, isLoading } = useSWR(
    trimmedQuery ? ["search", trimmedQuery] : null,
    ([, term]) => search(term),
    { keepPreviousData: false },
  )

  const hasQuery = query.trim().length > 0
  // Loading only reflects the debounced term actually being fetched —
  // not the raw keystrokes still being typed/debounced.
  const isSearching = hasQuery && trimmedQuery.length > 0 && isLoading
  const userCount = data?.users.length ?? 0
  const postCount = data?.posts.length ?? 0
  const hasResults = userCount > 0 || postCount > 0
  const showNoResults =
    hasQuery && trimmedQuery.length > 0 && !isSearching && data && !hasResults

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
            placeholder="Search Pulse"
            className="h-10 pl-9"
            aria-label="Search people and posts"
            autoComplete="off"
          />
        </div>
      </div>

      {!hasQuery ? (
        discover ?? (
          <div className="p-4">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchIcon />
                </EmptyMedia>
                <EmptyTitle>Find people and posts</EmptyTitle>
                <EmptyDescription>
                  Search by name, username, or post content to discover
                  accounts and conversations on Pulse.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        )
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
              <EmptyDescription>
                Try a different name, username, or keyword.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : data ? (
        <div className="flex flex-col">
          {userCount > 0 ? (
            <div>
              <SectionLabel>
                <span className="flex items-center gap-1.5">
                  <UsersIcon className="size-3.5" aria-hidden="true" />
                  People
                </span>
              </SectionLabel>
              <div className="flex flex-col">
                {data.users.map((user) => (
                  <UserListItem
                    key={user.id}
                    user={user}
                    profileIdentifier={user.username ?? user.id}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {postCount > 0 ? (
            <div>
              <SectionLabel>Posts</SectionLabel>
              <div className="flex flex-col">
                {data.posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
