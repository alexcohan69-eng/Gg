import { ImageOffIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { BackButton } from "@/components/back-button"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"

export default function PortfolioProjectNotFound() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Project" leading={<BackButton />} />
      <div className="p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ImageOffIcon />
            </EmptyMedia>
            <EmptyTitle>This project doesn&apos;t exist</EmptyTitle>
            <EmptyDescription>
              It may have been removed or the link is incorrect.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </div>
  )
}
