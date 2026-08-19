import { PageHeader } from "@/components/page-header"
import { PostListSkeleton } from "@/components/post-list-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function HomeLoading() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Home" />
      <div className="flex gap-3 border-b border-border p-4">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <Skeleton className="h-9 flex-1 rounded-lg" />
      </div>
      <div className="flex border-b border-border">
        <Skeleton className="m-3 h-5 flex-1 rounded" />
        <Skeleton className="m-3 h-5 flex-1 rounded" />
      </div>
      <PostListSkeleton />
    </div>
  )
}
