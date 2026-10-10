import { notFound } from "next/navigation";
import { isAdminRequest } from "@/server/admin";

// Authoritative admin gate. middleware.ts only checks the IP allowlist
// (cheap, Edge-safe); this layout performs the real, Mongo-backed session
// check + ADMIN_USER_IDS allowlist, since that needs Node.js runtime driver
// access. Both checks must pass (docs/OPERATIONS.md, "Auth: in-house").
//
// This layout alone is NOT enough: each page under /admin repeats the
// check, because a layout and its page render in parallel (see the comment
// in page.tsx).
//
// Server Components can't return a raw 403 Response (only Route Handlers
// and middleware can) — notFound() is the App Router's mechanism for a
// hard-stop render with a non-200 status, and doubles as not revealing that
// an admin route exists to an unauthorized caller.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdminRequest())) notFound();
  return children;
}
