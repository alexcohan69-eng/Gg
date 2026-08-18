import type { Metadata } from "next"
import { PageHeader } from "@/components/page-header"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"
import { MailIcon } from "lucide-react"

export const metadata: Metadata = {
  title: "Messages",
}

export default function MessagesPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Messages" />
      <div className="p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MailIcon />
            </EmptyMedia>
            <EmptyTitle>No conversations yet</EmptyTitle>
            <EmptyDescription>
              Direct messaging arrives in a later phase, built on the
              conversations and messages tables already in the schema.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </div>
  )
}
