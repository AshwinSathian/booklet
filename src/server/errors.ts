import { NextResponse } from "next/server";
import { logError } from "@/lib/logger";

/** Typed error for the service layer — carries the HTTP status its message maps to. */
export class ServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus: number,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

/**
 * Maps a ServiceError to its JSON response (these are deliberately
 * user-facing messages — "Page not found", "Slug is already taken", etc.).
 * Anything else is an unexpected failure (a raw DB/driver error, say) whose
 * message was never meant for a client and could carry internal details —
 * log it and return the generic fallback instead of `err.message`.
 */
export function toErrorResponse(err: unknown, fallbackMessage = "Something went wrong"): NextResponse {
  if (err instanceof ServiceError) {
    return NextResponse.json({ error: err.message }, { status: err.httpStatus });
  }
  logError("toErrorResponse", fallbackMessage, err);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
