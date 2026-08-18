import type { Metadata } from "next"
import { PageHeader } from "@/components/page-header"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"
import { BellIcon } from "lucide-react"

export const metadata: Metadata = {
  title: "Notifications",
}

export default function NotificationsPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Notifications" />
      <div className="p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BellIcon />
            </EmptyMedia>
            <EmptyTitle>No notifications yet</EmptyTitle>
            <EmptyDescription>
              Likes, replies, and new followers will show up here once the
              notification system ships.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </div>
  )
}
