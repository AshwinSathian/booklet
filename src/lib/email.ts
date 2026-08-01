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
