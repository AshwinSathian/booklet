import { BookletApiError } from "booklet-api-client";

/** Exit codes. Listed in `booklet --help` and the README; scripts depend on them. */
export const EXIT = {
  OK: 0,
  FAILURE: 1,
  USAGE: 2,
  AUTH: 3,
  NOT_FOUND: 4,
  RATE_LIMITED: 5,
} as const;

export const EXIT_CODES_HELP = `Exit codes:
  0  success
  1  failure (network error, server error, rejected request)
  2  usage error (unknown command or option, missing argument)
  3  not authenticated, or not allowed
  4  page not found
  5  rate limited`;

/** An expected failure: `message` is shown to the user, `exitCode` is the process exit code. */
export class CliError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number = EXIT.FAILURE,
    /** HTTP status, when the failure came from the API. */
    public readonly status?: number,
  ) {
    super(message);
    this.name = "CliError";
  }
}

function exitCodeForStatus(status: number): number {
  if (status === 401 || status === 403) return EXIT.AUTH;
  if (status === 404) return EXIT.NOT_FOUND;
  if (status === 429) return EXIT.RATE_LIMITED;
  return EXIT.FAILURE;
}

/** Turns anything a command can throw into a CliError, optionally prefixing the message. */
export function toCliError(e: unknown, prefix?: string): CliError {
  if (e instanceof CliError) return e;
  const message = e instanceof Error ? e.message : String(e);
  const text = prefix ? `${prefix}: ${message}` : message;
  if (e instanceof BookletApiError) {
    const wait = e.retryAfter ? ` Try again in ${e.retryAfter} seconds.` : "";
    return new CliError(text + wait, exitCodeForStatus(e.status), e.status || undefined);
  }
  return new CliError(text);
}
