import { BackButton } from "@/components/back-button"
import { Skeleton } from "@/components/ui/skeleton"
import { MessageThreadSkeleton } from "@/components/loading-skeletons"

export default function ConversationLoading() {
  return (
    <div className="flex min-h-[calc(100svh-4rem-1px)] flex-col md:min-h-[calc(100svh-1px)]">
      <header className="sticky top-14 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm md:top-0">
        <BackButton />
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </header>
      <MessageThreadSkeleton />
    </div>
  )
}
