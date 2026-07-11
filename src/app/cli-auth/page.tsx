import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createApiKey, getApiKeysByUser } from "@/lib/db";
import { generateRawKey, hashApiKey } from "@/lib/api-key";
import { createId } from "@/lib/id";
import { AppLogo } from "@/components/ui/AppLogo";
import Link from "next/link";
import type { Metadata } from "next";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Authorize CLI — Readable",
  robots: { index: false },
};

const MAX_KEYS_PER_USER = 10;
const CLI_KEY_LABEL = "readable-cli";

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
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      <header className="border-b border-border-subtle">
        <div className="mx-auto w-full max-w-md px-4 py-3">
          <AppLogo onlyIcon={false} />
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-sm w-full rounded-2xl border border-border-subtle bg-bg-elevated p-8 text-center space-y-3">
          <p className="text-3xl">⚠</p>
          <h1 className="text-base font-semibold">{title}</h1>
          <p className="text-sm text-text-secondary leading-relaxed">{body}</p>
          <Link
            href="/my-pages"
            className="inline-block mt-2 text-sm text-accent hover:text-accent-soft transition-colors"
          >
            Go to My Pages →
          </Link>
        </div>
      </main>
    </div>
  );
}

export default async function CliAuthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const port = params.port;
  const state = params.state;

  // Reject malformed or missing params before touching auth
  if (!isValidPort(port) || !isValidState(state)) {
    return (
      <ErrorPage
        title="Invalid request"
        body="Missing or invalid parameters. Run `readable login` in your terminal to start a new login flow."
      />
    );
  }

  const session = await getSession();

  if (!session) {
    // Not signed in — send to sign-in, which will redirect back here after auth
    const returnUrl = encodeURIComponent(`/cli-auth?port=${port}&state=${state}`);
    redirect(`/sign-in?redirect_url=${returnUrl}`);
  }
  const { userId } = session;

  // Signed in — check key limit before creating
  const existing = await getApiKeysByUser(userId);
  if (existing.length >= MAX_KEYS_PER_USER) {
    return (
      <ErrorPage
        title="API key limit reached"
        body={`You have ${MAX_KEYS_PER_USER} API keys — the maximum allowed. Delete an unused key from My Pages → Settings → API Keys, then run \`readable login\` again.`}
      />
    );
  }

  // Create the CLI key
  try {
    const raw = generateRawKey();
    const keyHash = await hashApiKey(raw);
    const id = createId(16);
    await createApiKey(id, userId, keyHash, CLI_KEY_LABEL);

    // Redirect to the CLI's local callback server — browser follows the 307
    // 127.0.0.1 is exempt from HSTS (RFC 6797 §8.3) so HTTP is safe here
    const callbackUrl =
      `http://127.0.0.1:${port}/callback` +
      `?key=${encodeURIComponent(raw)}` +
      `&state=${encodeURIComponent(state)}`;
    redirect(callbackUrl);
  } catch {
    return (
      <ErrorPage
        title="Something went wrong"
        body="We couldn't create your API key. Please try again or generate one manually from My Pages → Settings → API Keys."
      />
    );
  }
}
