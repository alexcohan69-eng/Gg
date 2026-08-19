import { PageHeader } from "@/components/page-header"
import { ConversationListSkeleton } from "@/components/loading-skeletons"

export default function MessagesLoading() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Messages" />
      <ConversationListSkeleton />
    </div>
  )
}
