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
    <AuthLayout title="Reset your password">
      <div className="text-center">
        <p className="text-sm text-text-secondary">Enter your email and we&apos;ll send you a reset link.</p>
      </div>
      <ForgotPasswordForm />
      <p className="text-center text-sm text-text-secondary">
        <Link href={ROUTES.signIn} className="link">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
