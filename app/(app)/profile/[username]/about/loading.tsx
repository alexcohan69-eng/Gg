import { PageHeader } from "@/components/page-header"
import { BackButton } from "@/components/back-button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function ProfileAboutLoading() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Profile" description="About this account" leading={<BackButton />} />

      <div className="flex flex-col gap-4 p-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-3">
            <Skeleton className="size-16 rounded-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-36" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid grid-cols-3 gap-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
