/** Sends a JSON request and returns an error message, or null when it worked. */
export async function send(url: string, method: string, body?: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method,
      ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    });
    if (res.ok) return null;
    return ((await res.json().catch(() => ({}))) as { detail?: string }).detail ?? "Something went wrong. Try again.";
  } catch {
    return "Network error. Try again.";
  }
}
