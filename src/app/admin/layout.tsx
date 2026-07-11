import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";

// Authoritative admin gate. middleware.ts only checks the IP allowlist
// (cheap, Edge-safe); this layout performs the real, Mongo-backed session
// check + ADMIN_USER_IDS allowlist, since that needs Node.js runtime driver
// access. Both checks must pass — see PLAN-backend-auth-migration.md,
// "Admin authorization moves from middleware into admin/layout.tsx".
//
// Server Components can't return a raw 403 Response (only Route Handlers
// and middleware can) — notFound() is the App Router's mechanism for a
// hard-stop render with a non-200 status, and doubles as not revealing that
// an admin route exists to an unauthorized caller.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const isDev = process.env.NODE_ENV === "development";

  if (!isDev) {
    const session = await getSession();
    const allowedUserIds = (process.env.ADMIN_USER_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!session || allowedUserIds.length === 0 || !allowedUserIds.includes(session.userId)) {
      notFound();
    }
  }

  return children;
}
