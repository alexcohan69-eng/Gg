import { Skeleton } from "@/components/ui/skeleton"

/** Placeholder shown while a followers/following list loads. */
export function UserListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading people">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-start gap-3 border-b border-border p-4">
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2 pt-0.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <Skeleton className="h-8 w-24 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  )
}
