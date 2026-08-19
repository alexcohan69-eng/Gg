import { PageHeader } from "@/components/page-header"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function SettingsLoading() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Settings" description="Manage your account and profile" />

      <div
        className="flex flex-col gap-6 p-4"
        role="status"
        aria-label="Loading settings"
      >
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-56" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3.5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-9 w-28" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
