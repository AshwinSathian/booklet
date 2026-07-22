import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createApiKey, getApiKeysByUser } from "@/lib/db";
import { generateRawKey, hashApiKey } from "@/lib/api-key";
import { createId } from "@/lib/id";
import { AuthLayout } from "@/components/auth/AuthLayout";
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

  // Create the CLI key. `redirect()` below throws a NEXT_REDIRECT error that
  // Next.js catches higher up the tree — it must NOT be inside this try, or
  // that throw gets swallowed here and every successful login renders the
  // catch's error page instead of completing (found live: this was firing
  // on every login attempt, success or not).
  let callbackUrl: string;
  try {
    const raw = generateRawKey();
    const keyHash = await hashApiKey(raw);
    const id = createId(16);
    await createApiKey(id, userId, keyHash, CLI_KEY_LABEL);

    // Redirect to the CLI's local callback server — browser follows the 307
    // 127.0.0.1 is exempt from HSTS (RFC 6797 §8.3) so HTTP is safe here
    callbackUrl =
      `http://127.0.0.1:${port}/callback` +
      `?key=${encodeURIComponent(raw)}` +
      `&state=${encodeURIComponent(state)}`;
  } catch {
    return (
      <ErrorPage
        title="Something went wrong"
        body="We couldn't create your API key. Please try again or generate one manually from My Pages → Settings → API Keys."
      />
    );
  }
  redirect(callbackUrl);
}
