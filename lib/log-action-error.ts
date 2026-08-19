/**
 * Every mutating server action catches its own errors and returns a
 * generic, user-facing message (`{ success: false, error: "..." }`)
 * instead of throwing — that's the right call for UX, since a raw
 * exception message should never reach the client. The gap this
 * closes: several of those `catch` blocks discarded the real error
 * entirely, so an unexpected failure (a dropped Aurora connection, an
 * IAM token refresh error, a constraint violation) left no trace
 * anywhere. A support report of "block/report/message isn't working"
 * was previously undebuggable from the server side alone.
 *
 * Call this at the top of every such `catch`, before returning the
 * friendly result. It intentionally does nothing fancier than
 * `console.error` — this app has no external log sink configured, so
 * the highest-value, lowest-risk move is making sure the error always
 * reaches stdout/stderr (where the platform's log viewer picks it up)
 * with enough context to find it, not building a logging framework.
 *
 * `context` is for identifiers only (userId, postId, conversationId,
 * etc.) — never pass raw request bodies, tokens, or other user input
 * that could leak sensitive content into logs.
 */
export function logActionError(
  action: string,
  error: unknown,
  context?: Record<string, string | number | boolean | null | undefined>,
) {
  console.error(
    `[v0] ${action} failed:`,
    error instanceof Error ? error.message : error,
    context ?? {},
  )
}
