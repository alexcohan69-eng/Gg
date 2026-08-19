import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const BUBBLE_WIDTHS = ["w-40", "w-56", "w-32", "w-48", "w-24", "w-44"]

/** Placeholder shown while a message thread's history loads. */
export function MessageThreadSkeleton() {
  return (
    <div
      className="flex flex-1 flex-col gap-2 p-4"
      role="status"
      aria-label="Loading conversation"
    >
      {BUBBLE_WIDTHS.map((width, index) => (
        <div
          key={index}
          className={cn("flex", index % 2 === 0 ? "justify-start" : "justify-end")}
        >
          <Skeleton className={cn("h-9 rounded-2xl", width)} />
        </div>
      ))}
    </div>
  )
}
