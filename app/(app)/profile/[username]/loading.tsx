import { PageHeader } from "@/components/page-header"
import { BackButton } from "@/components/back-button"
import { Skeleton } from "@/components/ui/skeleton"
import { PostFeedSkeleton } from "@/components/loading-skeletons"

export default function ProfileLoading() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Profile" leading={<BackButton />} />

      {/* Profile header placeholder */}
      <div
        className="flex flex-col"
        role="status"
        aria-label="Loading profile"
      >
        <Skeleton className="h-32 w-full rounded-none" />
        <div className="px-4">
          <Skeleton className="-mt-10 size-20 rounded-full border-4 border-background" />
          <div className="mt-3 flex flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="mt-2 h-3.5 w-full max-w-[20rem]" />
            <Skeleton className="h-3.5 w-24" />
          </div>
        </div>
        <span className="sr-only">Loading…</span>
      </div>

      <div className="mt-4 border-t border-border">
        <PostFeedSkeleton />
      </div>
    </div>
  )
}
