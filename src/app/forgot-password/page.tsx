import { AuthLayout } from "@/components/auth/AuthLayout";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = buildMetadata({
  title: "Forgot password",
  description: "Reset your Booklet account password.",
  pathname: "/forgot-password",
  noIndex: true,
});

export default function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <div className="text-center">
        <p className="text-sm text-text-secondary">Enter your email and we&apos;ll send you a reset link.</p>
      </div>
      <ForgotPasswordForm />
      <p className="text-xs text-text-muted text-center">
        <Link href={ROUTES.signIn} className="text-accent hover:text-accent-soft transition-colors">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
