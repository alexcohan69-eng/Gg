import { ChevronLeftIcon } from "lucide-react"
import { MessageThreadSkeleton } from "@/components/message-thread-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function ConversationLoading() {
  return (
    <div className="flex min-h-[calc(100svh-4rem-1px)] flex-col md:min-h-[calc(100svh-1px)]">
      <header className="sticky top-14 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm md:top-0">
        <ChevronLeftIcon
          className="size-5 text-muted-foreground"
          aria-hidden="true"
        />
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </header>
      <MessageThreadSkeleton />
      <div className="sticky bottom-14 z-20 flex items-end gap-2 border-t border-border bg-background p-3 md:bottom-0">
        <Skeleton className="h-10 flex-1 rounded-2xl" />
        <Skeleton className="size-10 shrink-0 rounded-full" />
      </div>
    </div>
  )
}
