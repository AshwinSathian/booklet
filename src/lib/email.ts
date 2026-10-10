import { Resend } from "resend";

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not set. Transactional email cannot be sent without it — set RESEND_API_KEY in the environment (see .env.example).",
    );
  }
  return new Resend(apiKey);
}

const FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || "Booklet <noreply@booklet.ashwinsathian.com>";

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const resend = getResendClient();
  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: "Reset your Booklet password",
    html: `
      <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <p>Someone requested a password reset for this Booklet account.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;background:#f5a623;color:#0a0a0a;padding:10px 20px;border-radius:9999px;text-decoration:none;font-weight:600;">
            Reset password
          </a>
        </p>
        <p style="color:#666;font-size:13px;">
          This link expires in 30 minutes. If you didn't request this, ignore this email — your password won't change.
        </p>
      </div>
    `,
  });
}

export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
  const { error } = await getResendClient().emails.send({
    from: FROM_ADDRESS,
    to,
    subject: "Confirm your email for Booklet",
    html: `
      <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <p>Confirm this address to publish pages from your Booklet account.</p>
        <p>
          <a href="${verifyUrl}" style="display:inline-block;background:#f5a623;color:#0a0a0a;padding:10px 20px;border-radius:9999px;text-decoration:none;font-weight:600;">
            Confirm email
          </a>
        </p>
        <p style="color:#666;font-size:13px;">
          This link works for 24 hours. If you did not create a Booklet account, ignore this email and do not open the link.
        </p>
      </div>
    `,
  });
  if (error) throw new Error(`Resend rejected the verification email: ${error.message}`);
}

/**
 * Notifies the abuse inbox of a new report. Plain text on purpose: every
 * field below except the URL is written by an anonymous reporter, and a
 * text body cannot carry markup.
 *
 * Returns false (and sends nothing) when ABUSE_REPORT_EMAIL or
 * RESEND_API_KEY is unset — the report is still stored and shows in
 * /admin/reports, so a missing mail config must not fail the request.
 */
export async function sendAbuseReportEmail(report: {
  pageUrl: string;
  adminUrl: string;
  reason: string;
  detail: string | null;
  reporterEmail: string | null;
}): Promise<boolean> {
  const to = process.env.ABUSE_REPORT_EMAIL;
  if (!to || !process.env.RESEND_API_KEY) return false;

  const { error } = await getResendClient().emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `Booklet abuse report: ${report.reason}`,
    text: [
      `Page: ${report.pageUrl}`,
      `Reason: ${report.reason}`,
      `Reporter: ${report.reporterEmail ?? "(not given)"}`,
      "",
      report.detail ?? "(no detail given)",
      "",
      `Review: ${report.adminUrl}`,
    ].join("\n"),
  });
  if (error) throw new Error(`Resend rejected the abuse report email: ${error.message}`);
  return true;
}
