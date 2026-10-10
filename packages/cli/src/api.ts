import { createClient, BookletApiError, type BookletClient } from "booklet-api-client";
import { getApiKey, getApiBase } from "./config.js";
import { CliError, EXIT } from "./errors.js";

export { BookletApiError };

/**
 * Builds a client from the saved config (~/.booklet/config.json or
 * BOOKLET_API_KEY). Throws the "not authenticated" error (exit code 3)
 * when there is no key. A 429 is retried once after the server's
 * Retry-After.
 */
export async function requireClient(): Promise<BookletClient> {
  const key = await getApiKey();
  if (!key) throw new CliError("Not authenticated. Run `booklet login` to set your API key.", EXIT.AUTH);
  return createClient({ baseUrl: await getApiBase(), apiKey: key, source: "cli", retryOnRateLimit: true });
}
