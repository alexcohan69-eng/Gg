import { NextResponse } from "next/server"

/**
 * Every `/api/v1/*` route throws `ApiError` instead of returning ad
 * hoc responses, so a single catch block per route can map any
 * failure (including one thrown deep inside a reused `app/actions/*`
 * helper) to a consistent JSON error shape.
 */
export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status })
}

export function apiErrorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status })
}

/**
 * Wraps a route handler body so any thrown error (an `ApiError` or an
 * unexpected one) becomes a well-formed JSON response instead of a
 * leaked stack trace or an unhandled 500.
 */
export async function withApiErrorHandling(
  handler: () => Promise<Response>,
): Promise<Response> {
  try {
    return await handler()
  } catch (error) {
    if (error instanceof ApiError) {
      return apiErrorResponse(error.status, error.code, error.message)
    }
    console.error("[v0] Unhandled /api/v1 error:", error)
    return apiErrorResponse(500, "internal_error", "Something went wrong.")
  }
}
