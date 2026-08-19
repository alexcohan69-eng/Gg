"use client"

import { useRouter } from "next/navigation"
import useSWR from "swr"
import { ArrowUpIcon } from "lucide-react"

type NewPostsResponse = { count: number }

async function fetcher(url: string): Promise<NewPostsResponse> {
  const response = await fetch(url)
  if (!response.ok) throw new Error("Failed to check for new posts")
  return response.json()
}

const POLL_INTERVAL_MS = 20000

/**
 * Polls for posts newer than the ones currently rendered and surfaces
 * a "Show N new posts" pill instead of auto-inserting them into the
 * list — auto-prepending would yank the feed out from under anyone
 * mid-scroll or mid-read, so new content only lands once the viewer
 * asks for it.
 *
 * `sinceIso` is the timestamp of the topmost post already on screen,
 * server-rendered by the home page. Because it's a prop (not client
 * state), clicking the banner and calling `router.refresh()` re-renders
 * the page with fresh posts and a new `sinceIso` — which changes this
 * component's SWR key, so the count naturally resets to 0 once the
 * viewer is caught up, with no extra state to manage here.
 */
export function NewPostsBanner({
  tab,
  sinceIso,
}: {
  tab: "for-you" | "following"
  sinceIso: string | null
}) {
  const router = useRouter()

  const { data } = useSWR<NewPostsResponse>(
    sinceIso
      ? `/api/feed/new-posts?tab=${tab}&since=${encodeURIComponent(sinceIso)}`
      : null,
    fetcher,
    { refreshInterval: POLL_INTERVAL_MS, revalidateOnFocus: true },
  )

  const count = data?.count ?? 0
  if (count === 0) return null

  function handleShowNewPosts() {
    window.scrollTo({ top: 0, behavior: "smooth" })
    router.refresh()
  }

  return (
    <div className="flex justify-center border-b border-border py-2">
      <button
        type="button"
        onClick={handleShowNewPosts}
        className="flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
      >
        <ArrowUpIcon className="size-4" aria-hidden="true" />
        {count === 1 ? "Show 1 new post" : `Show ${count} new posts`}
      </button>
    </div>
  )
}
