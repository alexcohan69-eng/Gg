import type { Metadata } from "next"
import { PageHeader } from "@/components/page-header"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"
import { BookmarkIcon } from "lucide-react"

export const metadata: Metadata = {
  title: "Bookmarks",
}

export default function BookmarksPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Bookmarks" />
      <div className="p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookmarkIcon />
            </EmptyMedia>
            <EmptyTitle>Nothing saved yet</EmptyTitle>
            <EmptyDescription>
              Posts you bookmark will be collected here once the post
              system ships.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </div>
  )
}
