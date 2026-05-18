"use client";

import { AppLogo } from "@/components/ui/AppLogo";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

// ---------------------------------------------------------------------------
// Feature list rows
// ---------------------------------------------------------------------------

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0 text-accent">
      <path d="M3 8l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Dash() {
  return <span className="block w-4 h-[2px] rounded-full bg-border-default mx-auto" aria-hidden />;
}

type Feature = { label: string; free: boolean; pro: boolean; teams: boolean };

const FEATURES: Feature[] = [
  { label: "Unlimited local drafts", free: true, pro: true, teams: true },
  { label: "Publish pages instantly", free: true, pro: true, teams: true },
  { label: "All Markdown / GFM rendering", free: true, pro: true, teams: true },
  { label: "Mermaid diagrams", free: true, pro: true, teams: true },
  { label: "Templates library", free: true, pro: true, teams: true },
  { label: "Export (MD, HTML, PDF)", free: true, pro: true, teams: true },
  { label: "Permanent pages", free: true, pro: true, teams: true },
  { label: "Custom URL slugs", free: true, pro: true, teams: true },
  { label: "Page analytics", free: true, pro: true, teams: true },
  { label: "2 API keys", free: true, pro: false, teams: false },
  { label: "Version history (10 versions)", free: false, pro: true, teams: true },
  { label: "Password-protected pages", free: false, pro: true, teams: true },
  { label: "10 API keys", free: false, pro: true, teams: false },
  { label: "Remove attribution badge", free: false, pro: true, teams: true },
  { label: "Unlimited API keys", free: false, pro: false, teams: true },
  { label: "Shared team workspace", free: false, pro: false, teams: true },
  { label: "Team analytics", free: false, pro: false, teams: true },
  { label: "Publish webhooks", free: false, pro: false, teams: true },
];

// ---------------------------------------------------------------------------
// Pricing page
// ---------------------------------------------------------------------------

export default function PricingPage() {
  const { isSignedIn } = useUser();
  const router = useRouter();

  async function handleUpgrade(priceId: string) {
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent("/pricing")}`);
      return;
    }
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ priceId }),
    });
    const data = (await res.json()) as { checkoutUrl?: string; error?: string };
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    }
  }

  const PRO_MONTHLY = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY ?? "";
  const TEAMS_MONTHLY = process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAMS ?? "";

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      {/* Nav */}
      <header className="border-b border-border-subtle">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/"><AppLogo onlyIcon={false} /></Link>
          <Button variant="secondary" size="sm" href="/app">Open editor</Button>
        </div>
      </header>

      {/* Hero */}
      <div className="mx-auto max-w-5xl px-6 pt-16 pb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Simple, honest pricing</h1>
        <p className="mt-3 text-base text-text-secondary max-w-xl mx-auto">
          Start free. Pay when you need more. No surprises.
        </p>
      </div>

      {/* Tiers */}
      <div className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Free */}
          <div className="rounded-2xl border border-border-default bg-bg-elevated p-8 flex flex-col">
            <p className="text-sm font-semibold text-text-muted uppercase tracking-wider">Free</p>
            <p className="mt-3 text-3xl font-bold">$0</p>
            <p className="mt-1 text-xs text-text-muted">forever</p>
            <p className="mt-4 text-sm text-text-secondary leading-relaxed">
              Everything you need to write, publish, and share Markdown pages instantly.
            </p>
            <div className="mt-6">
              <Button variant="secondary" size="md" href="/app" className="w-full justify-center">
                Open the editor
              </Button>
            </div>
          </div>

          {/* Pro */}
          <div className="rounded-2xl border-2 border-accent bg-bg-elevated p-8 flex flex-col relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-pill bg-accent px-3 py-0.5 text-2xs font-semibold text-white">
              Most popular
            </span>
            <p className="text-sm font-semibold text-accent uppercase tracking-wider">Readable Pro</p>
            <p className="mt-3 text-3xl font-bold">$7</p>
            <p className="mt-1 text-xs text-text-muted">per month</p>
            <p className="mt-4 text-sm text-text-secondary leading-relaxed">
              For individuals who publish regularly and want the full experience.
            </p>
            <div className="mt-6">
              <Button
                variant="primary"
                size="md"
                className="w-full justify-center"
                onClick={() => void handleUpgrade(PRO_MONTHLY)}
              >
                Upgrade to Pro
              </Button>
            </div>
          </div>

          {/* Teams */}
          <div className="rounded-2xl border border-border-default bg-bg-elevated p-8 flex flex-col">
            <p className="text-sm font-semibold text-text-muted uppercase tracking-wider">Teams</p>
            <p className="mt-3 text-3xl font-bold">$12</p>
            <p className="mt-1 text-xs text-text-muted">per user / month</p>
            <p className="mt-4 text-sm text-text-secondary leading-relaxed">
              A shared workspace for your team. Publish together, see it together.
            </p>
            <div className="mt-6">
              <Button
                variant="secondary"
                size="md"
                className="w-full justify-center"
                onClick={() => void handleUpgrade(TEAMS_MONTHLY)}
              >
                Start team trial
              </Button>
            </div>
          </div>
        </div>

        {/* Feature comparison table */}
        <div className="mt-16 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border-default">
                <th className="pb-3 text-left font-semibold text-text-primary w-1/2">Feature</th>
                <th className="pb-3 text-center font-semibold text-text-muted w-[16%]">Free</th>
                <th className="pb-3 text-center font-semibold text-accent w-[16%]">Pro</th>
                <th className="pb-3 text-center font-semibold text-text-muted w-[16%]">Teams</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f) => (
                <tr key={f.label} className="border-b border-border-subtle last:border-0">
                  <td className="py-3 text-text-secondary">{f.label}</td>
                  <td className="py-3 text-center">{f.free ? <Check /> : <Dash />}</td>
                  <td className="py-3 text-center">{f.pro || f.free ? <Check /> : <Dash />}</td>
                  <td className="py-3 text-center">{f.teams || f.pro || f.free ? <Check /> : <Dash />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer note */}
        <p className="mt-10 text-center text-xs text-text-muted">
          All plans include unlimited local drafts and drafts are never transmitted until you publish.
          Cancel anytime.{" "}
          <Link href="/app" className="text-accent hover:text-accent-soft underline">
            Start writing free →
          </Link>
        </p>
      </div>
    </div>
  );
}
