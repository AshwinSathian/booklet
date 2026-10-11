// Structured logging: JSON lines to stdout/stderr (PM2's log files), which
// `pm2 logs | jq` can read. An error is also counted in the database by
// fingerprint (src/lib/db/error-events.ts), which is what /admin lists and
// what the optional alert email is sent from.

type LogFields = Record<string, unknown>;

function serializeError(err: unknown): LogFields {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { value: err };
}

function line(level: "error" | "warn" | "info", scope: string, message: string, extra?: LogFields) {
  return JSON.stringify({
    level,
    scope,
    message,
    timestamp: new Date().toISOString(),
    ...extra,
  });
}

export function logError(scope: string, message: string, err?: unknown, extra?: LogFields): void {
  const error = err !== undefined ? serializeError(err) : undefined;
  console.error(line("error", scope, message, {
    ...(error ? { error } : {}),
    ...extra,
  }));
  // Counted for /admin and the alert email. Node runtime only (it needs the
  // database driver), loaded on demand so this file stays importable from
  // anywhere, and never awaited: logging must not slow or fail its caller.
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.BOOKLET_RECORD_ERRORS === "1") {
    void import("@/lib/db/error-events").then((m) => m.recordErrorEvent(scope, message, error)).catch(() => {});
  }
}

export function logWarn(scope: string, message: string, extra?: LogFields): void {
  console.warn(line("warn", scope, message, extra));
}

export function logInfo(scope: string, message: string, extra?: LogFields): void {
  console.log(line("info", scope, message, extra));
}
