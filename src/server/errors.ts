import { NextResponse } from "next/server";

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

/** Maps a ServiceError to its JSON response; anything else falls back to a generic 500. */
export function toErrorResponse(err: unknown, fallbackMessage = "Something went wrong"): NextResponse {
  if (err instanceof ServiceError) {
    return NextResponse.json({ error: err.message }, { status: err.httpStatus });
  }
  const message = err instanceof Error ? err.message : fallbackMessage;
  return NextResponse.json({ error: message }, { status: 500 });
}
