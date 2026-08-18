import { UserXIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { BackButton } from "@/components/back-button"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"

export default function ProfileNotFound() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Profile" leading={<BackButton />} />
      <div className="p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserXIcon />
            </EmptyMedia>
            <EmptyTitle>This account doesn&apos;t exist</EmptyTitle>
            <EmptyDescription>
              Try searching for another account.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </div>
  )
}
