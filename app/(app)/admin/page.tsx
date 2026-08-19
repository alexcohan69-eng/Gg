import type { Metadata } from "next"
import Link from "next/link"
import { PageHeader } from "@/components/page-header"
import { AdminReportList } from "@/components/admin-report-list"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { requireAdminSession } from "@/lib/admin"
import { getReports, type ReportStatus } from "@/lib/reports"

export const metadata: Metadata = {
  title: "Moderation",
}

const STATUSES: ReportStatus[] = ["open", "resolved", "dismissed"]

function isReportStatus(value: string | undefined): value is ReportStatus {
  return STATUSES.includes(value as ReportStatus)
}

/**
 * Admin-only report review queue. Gated by `requireAdminSession`
 * (redirects non-admins to `/home`), not linked from any nav item a
 * regular user can see — reachable only by a signed-in admin who
 * knows the URL, which is the point.
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requireAdminSession()

  const { status: rawStatus } = await searchParams
  const status: ReportStatus = isReportStatus(rawStatus) ? rawStatus : "open"

  const reports = await getReports(status)

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Moderation"
        description="Review reports submitted by users"
      />

      <div className="p-4">
        {/* Each tab is a real link (?status=...) so the selected tab
            survives a full page reload — the page itself is a Server
            Component that re-fetches for the requested status, so
            `defaultValue` (not a controlled `value`/`onValueChange`)
            is enough to keep the underlined tab in sync after nav. */}
        <Tabs defaultValue={status} key={status}>
          <TabsList>
            {STATUSES.map((s) => (
              <TabsTrigger key={s} value={s} render={<Link href={`/admin?status=${s}`} />}>
                {s === "open" ? "Open" : s === "resolved" ? "Resolved" : "Dismissed"}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={status}>
            <AdminReportList reports={reports} status={status} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
