"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckIcon, RotateCcwIcon, Trash2Icon, XIcon } from "lucide-react"
import {
  adminDeletePost,
  dismissReport,
  reopenReport,
  resolveReport,
} from "@/app/actions/admin"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import { REPORT_REASONS } from "@/lib/moderation"
import type { ReportRow, ReportStatus } from "@/lib/reports"
import { formatRelativeTime, profileHref } from "@/lib/utils"

function reasonLabel(reason: string) {
  return REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason
}

function TargetPreview({ target }: { target: ReportRow["target"] }) {
  if (!target.exists) {
    return (
      <p className="text-sm text-muted-foreground italic">
        {target.type === "post" ? "Post" : "User"} no longer exists (already removed)
      </p>
    )
  }

  if (target.type === "post") {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <Link
          href={profileHref({ id: target.authorId, username: target.authorUsername })}
          className="text-sm font-medium text-foreground hover:underline"
        >
          {target.authorName}
          <span className="ml-1 text-muted-foreground">
            @{target.authorUsername ?? "user"}
          </span>
        </Link>
        <p className="mt-1 line-clamp-3 text-sm text-pretty text-foreground">
          {target.content || <span className="italic text-muted-foreground">No text content</span>}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <Link
        href={profileHref({ id: target.id, username: target.username })}
        className="text-sm font-medium text-foreground hover:underline"
      >
        {target.name}
        <span className="ml-1 text-muted-foreground">@{target.username ?? "user"}</span>
      </Link>
    </div>
  )
}

function ReportCard({ report }: { report: ReportRow }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  function runAction(action: () => Promise<{ success: boolean; error?: string }>, successMessage: string) {
    startTransition(async () => {
      const result = await action()
      if (!result.success) {
        toast.error(result.error ?? "Something went wrong.")
        return
      }
      toast.success(successMessage)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3 border-b border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary">{report.targetType === "post" ? "Post" : "User"}</Badge>
          <Badge variant="outline">{reasonLabel(report.reason)}</Badge>
          <span className="text-muted-foreground">
            Reported by{" "}
            <Link
              href={profileHref({ id: report.reporterId, username: report.reporterUsername })}
              className="hover:underline"
            >
              @{report.reporterUsername ?? "user"}
            </Link>
          </span>
        </div>
        <time
          dateTime={new Date(report.createdAt).toISOString()}
          className="shrink-0 text-xs text-muted-foreground"
          suppressHydrationWarning
        >
          {formatRelativeTime(report.createdAt)}
        </time>
      </div>

      <TargetPreview target={report.target} />

      {report.status !== "open" && report.reviewedAt ? (
        <p className="text-xs text-muted-foreground">
          {report.status === "resolved" ? "Resolved" : "Dismissed"}{" "}
          {formatRelativeTime(report.reviewedAt)}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {report.status === "open" ? (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => runAction(() => resolveReport(report.id), "Report resolved")}
            >
              <CheckIcon data-icon="inline-start" />
              Resolve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => runAction(() => dismissReport(report.id), "Report dismissed")}
            >
              <XIcon data-icon="inline-start" />
              Dismiss
            </Button>
            {report.targetType === "post" && report.target.exists ? (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => setConfirmDeleteOpen(true)}
                >
                  <Trash2Icon data-icon="inline-start" />
                  Delete post
                </Button>

                <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this post?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently removes the post and its media, and marks this
                        report resolved. This can&apos;t be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        disabled={isPending}
                        onClick={() => {
                          setConfirmDeleteOpen(false)
                          runAction(
                            () => adminDeletePost(report.targetId, report.id),
                            "Post deleted",
                          )
                        }}
                      >
                        Delete post
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : null}
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => runAction(() => reopenReport(report.id), "Report reopened")}
          >
            <RotateCcwIcon data-icon="inline-start" />
            Reopen
          </Button>
        )}
      </div>
    </div>
  )
}

export function AdminReportList({
  reports,
  status,
}: {
  reports: ReportRow[]
  status: ReportStatus
}) {
  if (reports.length === 0) {
    return (
      <Empty className="border-0 py-16">
        <EmptyTitle>
          {status === "open" ? "No open reports" : `No ${status} reports`}
        </EmptyTitle>
        <EmptyDescription>
          {status === "open"
            ? "Reports submitted by users will show up here for review."
            : "Reports you've reviewed will show up here."}
        </EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col">
      {reports.map((report) => (
        <ReportCard key={report.id} report={report} />
      ))}
    </div>
  )
}
