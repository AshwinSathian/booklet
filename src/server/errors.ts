import { NextResponse } from "next/server";
import { logError } from "@/lib/logger";

/** Typed error for the service layer — carries the HTTP status its message maps to. */
export class ServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus: number,
    /** Extra problem-details members, e.g. which size limit was hit. */
    public extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

const TITLES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  410: "Gone",
  412: "Precondition Failed",
  413: "Content Too Large",
  422: "Unprocessable Content",
  429: "Too Many Requests",
  500: "Internal Server Error",
};

/**
 * An RFC 9457 problem-details response. `type` stays "about:blank", so
 * `title` is the status phrase and `detail` carries the specific message.
 * `error` repeats `detail`: it is the member every client read before
 * problem details existed, and it stays.
 */
export function problem(
  status: number,
  detail: string,
  extra?: Record<string, unknown>,
  headers?: Record<string, string>,
): NextResponse {
  return NextResponse.json(
    { type: "about:blank", title: TITLES[status] ?? "Error", status, detail, error: detail, ...extra },
    { status, headers: { "Content-Type": "application/problem+json", ...headers } },
  );
}

/**
 * Maps a ServiceError to its problem-details response (these are deliberately
 * user-facing messages — "Page not found", "Slug is already taken", etc.).
 * Anything else is an unexpected failure (a raw DB/driver error, say) whose
 * message was never meant for a client and could carry internal details —
 * log it and return the generic fallback instead of `err.message`.
 */
export function toErrorResponse(err: unknown, fallbackMessage = "Something went wrong"): NextResponse {
  if (err instanceof ServiceError) {
    return problem(err.httpStatus, err.message, { code: err.code, ...err.extra });
  }
  logError("toErrorResponse", fallbackMessage, err);
  return problem(500, fallbackMessage);
}
