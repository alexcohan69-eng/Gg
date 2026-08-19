import { Skeleton } from "@/components/ui/skeleton"

/** Placeholder matching `ProfileHeader`'s banner/avatar/bio layout. */
export function ProfileHeaderSkeleton() {
  return (
    <div className="flex flex-col" role="status" aria-label="Loading profile">
      <Skeleton className="h-36 w-full rounded-none sm:h-48" />
      <div className="px-4 pb-6">
        <div className="-mt-10 flex items-end justify-between sm:-mt-12">
          <Skeleton className="size-20 rounded-full border-4 border-background sm:size-24" />
          <Skeleton className="mt-10 h-9 w-28 rounded-full sm:mt-12" />
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-28" />
        </div>
        <Skeleton className="mt-3 h-3.5 w-full max-w-xs" />
        <div className="mt-4 flex gap-5">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      </div>
    </div>
  )
}
