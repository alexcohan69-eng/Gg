import { ProfileHeaderSkeleton } from "@/components/profile-header-skeleton"
import { PostListSkeleton } from "@/components/post-list-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function ProfileLoading() {
  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-4 backdrop-blur-sm">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      </header>
      <ProfileHeaderSkeleton />
      <div className="border-t border-border">
        <PostListSkeleton />
      </div>
    </div>
  )
}
