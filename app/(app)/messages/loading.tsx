import { PageHeader } from "@/components/page-header"
import { ConversationListSkeleton } from "@/components/conversation-list-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function MessagesLoading() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Messages">
        <Skeleton className="size-8 rounded-full" />
      </PageHeader>
      <ConversationListSkeleton />
    </div>
  )
}
