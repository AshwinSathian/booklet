import { createClient, BookletApiError, type BookletClient } from "booklet-api-client";
import { getApiKey, getApiBase } from "./config.js";

export { BookletApiError };

export const NOT_AUTHENTICATED_ERROR = "Not authenticated. Run `booklet login` to set your API key.";

/** Builds a client from the saved config (~/.booklet/config.json or BOOKLET_API_KEY). */
export async function getClient(): Promise<BookletClient | null> {
  const key = await getApiKey();
  if (!key) return null;
  const base = await getApiBase();
  return createClient({ baseUrl: base, apiKey: key, source: "cli" });
}

/** Extracts a display-ready message from any error a client call can throw. */
export function apiErrorMessage(e: unknown): string {
  if (e instanceof BookletApiError) return e.message;
  return e instanceof Error ? e.message : String(e);
}
