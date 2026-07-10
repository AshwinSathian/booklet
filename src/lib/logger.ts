// Lightweight structured logging — JSON lines to stdout/stderr instead of
// free-form console.error(string, err) calls, so whatever log aggregation
// gets added later (an external error tracker, or just `pm2 logs | jq`) has
// something structured to parse. This is a single-process PM2 app; stdout/
// stderr is the only sink that matters today. See docs/OPERATIONS.md for
// what a future external error-tracker integration would look like.

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
  console.error(line("error", scope, message, {
    ...(err !== undefined ? { error: serializeError(err) } : {}),
    ...extra,
  }));
}

export function logWarn(scope: string, message: string, extra?: LogFields): void {
  console.warn(line("warn", scope, message, extra));
}

export function logInfo(scope: string, message: string, extra?: LogFields): void {
  console.log(line("info", scope, message, extra));
}
