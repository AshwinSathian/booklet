import { createClient, ReadableApiError, type ReadableClient } from "readable-api-client";
import { getApiKey, getApiBase } from "./config.js";

export { ReadableApiError };

export const NOT_AUTHENTICATED_ERROR = "Not authenticated. Run `readable login` to set your API key.";

/** Builds a client from the saved config (~/.readable/config.json or READABLE_API_KEY). */
export async function getClient(): Promise<ReadableClient | null> {
  const key = await getApiKey();
  if (!key) return null;
  const base = await getApiBase();
  return createClient({ baseUrl: base, apiKey: key, source: "cli" });
}

/** Extracts a display-ready message from any error a client call can throw. */
export function apiErrorMessage(e: unknown): string {
  if (e instanceof ReadableApiError) return e.message;
  return e instanceof Error ? e.message : String(e);
}
