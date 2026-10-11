import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { OAuthConsent } from "@/components/auth/OAuthConsent";
import { absoluteUrl } from "@/lib/seo";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateAuthorizeRequest, type AuthorizeParams } from "@/lib/oauth/server";
import Link from "next/link";
import type { Metadata } from "next";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Connect an app · Booklet",
  robots: { index: false },
};

const PARAMS = ["response_type", "client_id", "redirect_uri", "scope", "state", "code_challenge", "code_challenge_method", "resource"];

/** Where the grant will be delivered, in words a person can check. */
function describeDestination(redirectUri: string): string {
  const url = new URL(redirectUri);
  if (url.protocol === "https:") return url.host;
  if (url.protocol === "http:") return "an app on this computer";
  return `the ${url.protocol.replace(":", "")} app on this device`;
}

// The OAuth authorization endpoint. Like /cli-auth, a GET here only renders
// a confirmation screen: nothing is granted until the user clicks Allow,
// which POSTs to /api/oauth/authorize.
export default async function OAuthAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const all = await searchParams;
  // A parameter given twice is ambiguous; treat it as absent (RFC 6749 3.1).
  const params: AuthorizeParams = Object.fromEntries(
    PARAMS.map((k) => [k, typeof all[k] === "string" ? (all[k] as string) : undefined]),
  );

  // Derived from configuration, with the request's own host as the fallback.
  const h = await headers();
  const issuer = process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(absoluteUrl("/")).origin
    : `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  // Sign-in comes first. Validating the request can fetch the client's
  // metadata document from a host the caller chose, and that is not
  // something to do for an anonymous visitor.
  const session = await getSession();
  if (!session) {
    const qs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => e[1] !== undefined));
    redirect(`/sign-in?redirect_url=${encodeURIComponent(`/oauth/authorize?${qs}`)}`);
  }
  if (await checkRateLimit(`oauth_authorize_page__${session.userId}`, 30)) {
    return (
      <AuthLayout>
        <p className="text-sm text-text-secondary">Too many attempts. Wait a minute and try again.</p>
      </AuthLayout>
    );
  }

  const validation = await validateAuthorizeRequest(params, issuer);
  if (!validation.ok) {
    // Never redirect from here. Anyone can register a client with any
    // https redirect URI, so sending the browser to `redirect_uri` on a
    // bad request would make this page an open redirector: a link to
    // booklet that lands on a site of the sender's choosing, with no click.
    // The client is told about errors only after the user acts on the
    // consent screen (POST /api/oauth/authorize).
    return (
      <AuthLayout>
        <div className="text-center space-y-1.5">
          <h1 className="font-display text-2xl font-medium leading-tight tracking-[-0.02em]">This app can&apos;t be connected</h1>
          <p className="text-sm text-text-secondary leading-relaxed">{validation.message}</p>
        </div>
        <Link href="/docs/guides/mcp" className="text-sm link">
          MCP setup guide →
        </Link>
      </AuthLayout>
    );
  }

  const { client, redirectUri, scope } = validation.request;
  return (
    <AuthLayout>
      <OAuthConsent
        params={params}
        clientName={client.client_name}
        // The host of the client_id is a fact about who the client is: its
        // metadata document was fetched from there. The name is its own claim.
        clientHost={new URL(client.client_id).host}
        destination={describeDestination(redirectUri)}
        scope={scope}
      />
    </AuthLayout>
  );
}
