import type { Metadata } from "next"
import { PageHeader } from "@/components/page-header"
import { Input } from "@/components/ui/input"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"
import { SearchIcon, TrendingUpIcon } from "lucide-react"

export const metadata: Metadata = {
  title: "Explore",
}

export default function ExplorePage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Explore" description="Search people and posts" />
      <div className="p-4">
        <div className="relative mb-6 max-w-md">
          <SearchIcon
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            placeholder="Search Pulse"
            className="pl-9"
            aria-label="Search Pulse"
          />
        </div>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TrendingUpIcon />
            </EmptyMedia>
            <EmptyTitle>Discovery is coming soon</EmptyTitle>
            <EmptyDescription>
              Trending topics and search results will populate here once
              posts and profiles are searchable in a later phase.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </div>
  )
}
