import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { CliAuthorizeConfirm } from "@/components/auth/CliAuthorizeConfirm";
import Link from "next/link";
import type { Metadata } from "next";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Authorize CLI — Booklet",
  robots: { index: false },
};

function isValidPort(v: string | undefined): v is string {
  if (!v) return false;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1024 && n <= 65535;
}

// State must be exactly 40 hex chars (20 random bytes from the CLI)
function isValidState(v: string | undefined): v is string {
  if (!v) return false;
  return /^[a-f0-9]{40}$/.test(v);
}

function ErrorPage({ title, body }: { title: string; body: string }) {
  return (
    <AuthLayout>
      <p className="text-3xl">⚠</p>
      <div className="text-center space-y-1.5">
        <h1 className="text-base font-semibold">{title}</h1>
        <p className="text-sm text-text-secondary leading-relaxed">{body}</p>
      </div>
      <Link
        href="/my-pages"
        className="text-sm text-accent hover:text-accent-soft transition-colors"
      >
        Go to My Pages →
      </Link>
    </AuthLayout>
  );
}

// Renders a confirmation screen only — the actual API key is minted by an
// explicit user click (see CliAuthorizeConfirm -> POST
// /api/auth/cli-authorize), never by loading this page. A GET here has no
// side effects, so a hidden <img>/cross-site navigation to this URL with an
// attacker-chosen port+state can no longer silently mint and exfiltrate a
// live key — the victim has to consciously click "Authorize" after seeing
// which port it's headed to.
export default async function CliAuthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const port = params.port;
  const state = params.state;

  if (!isValidPort(port) || !isValidState(state)) {
    return (
      <ErrorPage
        title="Invalid request"
        body="Missing or invalid parameters. Run `booklet login` in your terminal to start a new login flow."
      />
    );
  }

  const session = await getSession();
  if (!session) {
    const returnUrl = encodeURIComponent(`/cli-auth?port=${port}&state=${state}`);
    redirect(`/sign-in?redirect_url=${returnUrl}`);
  }

  return (
    <AuthLayout>
      <CliAuthorizeConfirm port={port} state={state} />
    </AuthLayout>
  );
}
