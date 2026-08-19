import { ChevronLeftIcon } from "lucide-react"
import { PostListSkeleton } from "@/components/post-list-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function PostDetailLoading() {
  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-4 backdrop-blur-sm">
        <ChevronLeftIcon
          className="size-5 text-muted-foreground"
          aria-hidden="true"
        />
        <Skeleton className="h-5 w-16" />
      </header>
      <PostListSkeleton count={1} />
      <div className="flex gap-3 border-b border-border p-4">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <Skeleton className="h-9 flex-1 rounded-lg" />
      </div>
      <PostListSkeleton count={3} />
    </div>
  )
}
