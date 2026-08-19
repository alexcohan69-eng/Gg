import { PageHeader } from "@/components/page-header"
import { RowListSkeleton } from "@/components/loading-skeletons"

export default function MessagesLoading() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Messages" />
      <RowListSkeleton />
    </div>
  )
}
