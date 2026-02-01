import { headers } from "next/headers";

export async function getRequestOrigin(): Promise<string | null> {
  try {
    const h = await headers();

    const proto = h.get("x-forwarded-proto") ?? "https";
    const host = h.get("x-forwarded-host") ?? h.get("host");

    if (!host) return null;

    // host may include port; that's fine.
    return `${proto}://${host}`.replace(/\/$/, "");
  } catch {
    // headers() throws if called in wrong context
    return null;
  }
}
