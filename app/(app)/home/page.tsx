import type { Metadata } from "next"
import { PageHeader } from "@/components/page-header"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"
import { SparklesIcon } from "lucide-react"

export const metadata: Metadata = {
  title: "Home",
}

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Home" />
      <div className="p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SparklesIcon />
            </EmptyMedia>
            <EmptyTitle>Your feed is warming up</EmptyTitle>
            <EmptyDescription>
              Posting, replies, and the home timeline arrive in the next
              build phase. Follow people and post your first pulse once
              that&apos;s live.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </div>
  )
}
