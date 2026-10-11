import { AuthLayout } from "@/components/auth/AuthLayout";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = buildMetadata({
  title: "Reset password",
  description: "Set a new password for your Booklet account.",
  pathname: "/reset-password",
  noIndex: true,
});

export default function ResetPasswordPage() {
  return (
    <AuthLayout title="Choose a new password">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}
