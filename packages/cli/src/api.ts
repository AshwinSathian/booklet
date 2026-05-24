import { getApiKey, getApiBase } from "./config.js";

export type ApiResponse<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string };

const REQUEST_TIMEOUT_MS = 10_000;

export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<ApiResponse<T>> {
  const key = await getApiKey();
  if (!key) {
    return { ok: false, status: 401, error: "Not authenticated. Run `readable login` to set your API key." };
  }

  const base = await getApiBase();
  const url = `${base}${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "X-Readable-Source": "cli",
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 0, error: `Network error: ${msg}` };
  }

  let data: unknown;
  const ct = res.headers.get("content-type") ?? "";
  try {
    data = ct.includes("application/json") ? await res.json() : await res.text();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const errMsg =
      data && typeof data === "object" && "error" in (data as object)
        ? String((data as Record<string, unknown>).error)
        : `HTTP ${res.status}`;
    return { ok: false, status: res.status, error: errMsg };
  }

  return { ok: true, status: res.status, data: data as T };
}
