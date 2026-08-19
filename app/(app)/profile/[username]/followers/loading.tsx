import { ChevronLeftIcon } from "lucide-react"
import { UserListSkeleton } from "@/components/user-list-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function FollowersLoading() {
  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-4 backdrop-blur-sm">
        <ChevronLeftIcon
          className="size-5 text-muted-foreground"
          aria-hidden="true"
        />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3.5 w-16" />
        </div>
      </header>
      <UserListSkeleton />
    </div>
  )
}
