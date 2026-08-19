/**
 * Shared report-reason model for the report-post / report-user MVP.
 * Intentionally a small closed set of strings — no free-text field —
 * so submitting a report stays a single tap and there's no
 * moderation-review UI yet that would need to parse free text.
 */
export const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "other", label: "Other" },
] as const

export type ReportReason = (typeof REPORT_REASONS)[number]["value"]

export const REPORT_REASON_VALUES = REPORT_REASONS.map((r) => r.value)

export type ReportTargetType = "post" | "user"
