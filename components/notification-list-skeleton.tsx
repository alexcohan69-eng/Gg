import { Skeleton } from "@/components/ui/skeleton"

/** Placeholder shown while the notifications list loads. */
export function NotificationListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading notifications">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-start gap-3 border-b border-border p-4">
          <Skeleton className="size-6 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="size-6 shrink-0 rounded-full" />
              <Skeleton className="h-3.5 w-48" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}
