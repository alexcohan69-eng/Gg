import { PageHeader } from "@/components/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { PostListSkeleton } from "@/components/loading-skeletons"

export default function HomeLoading() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Home" />
      <div className="flex gap-3 border-b border-border p-4">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <Skeleton className="h-16 flex-1 rounded-lg" />
      </div>
      <div className="flex border-b border-border">
        <Skeleton className="m-3 h-4 flex-1" />
        <Skeleton className="m-3 h-4 flex-1" />
      </div>
      <PostListSkeleton />
    </div>
  )
}
