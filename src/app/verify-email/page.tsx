import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { buildMetadata } from "@/lib/seo";
import { VerifyEmailConfirm } from "./VerifyEmailConfirm";

export const metadata: Metadata = buildMetadata({
  title: "Confirm your email",
  description: "Confirm the email address on your Booklet account.",
  pathname: "/verify-email",
  noIndex: true,
});

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthLayout>
      <VerifyEmailConfirm token={token ?? ""} />
    </AuthLayout>
  );
}
