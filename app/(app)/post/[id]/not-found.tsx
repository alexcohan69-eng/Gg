import { FileQuestionIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { BackButton } from "@/components/back-button"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"

export default function PostNotFound() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Post" leading={<BackButton />} />
      <div className="p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileQuestionIcon />
            </EmptyMedia>
            <EmptyTitle>This post doesn&apos;t exist</EmptyTitle>
            <EmptyDescription>
              It may have been deleted, or the link is incorrect.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </div>
  )
}
