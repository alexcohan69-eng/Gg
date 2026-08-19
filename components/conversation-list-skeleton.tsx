import { Skeleton } from "@/components/ui/skeleton"

/** Placeholder shown while the inbox's conversation list loads. */
export function ConversationListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading conversations">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-start gap-3 border-b border-border p-4">
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-3.5 w-full max-w-[16rem]" />
          </div>
        </div>
      ))}
    </div>
  )
}
