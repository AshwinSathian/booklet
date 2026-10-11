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
        <p>Someone asked to reset the password of this Booklet account.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;background:#16150f;color:#fbfaf7;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
            Reset password
          </a>
        </p>
        <p style="color:#666;font-size:13px;">
          This link works for 30 minutes. If you did not ask for it, ignore this email and your password stays as it is.
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
          <a href="${verifyUrl}" style="display:inline-block;background:#16150f;color:#fbfaf7;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
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

/** The link that moves an account to this address, sent to the new address. */
export async function sendEmailChangeEmail(to: string, confirmUrl: string): Promise<void> {
  const { error } = await getResendClient().emails.send({
    from: FROM_ADDRESS,
    to,
    subject: "Confirm your new email address for Booklet",
    html: `
      <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <p>Someone who is signed in to a Booklet account asked to change its email address to this one.</p>
        <p>
          <a href="${confirmUrl}" style="display:inline-block;background:#16150f;color:#fbfaf7;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
            Use this address
          </a>
        </p>
        <p style="color:#666;font-size:13px;">
          This link works for 24 hours, and only while signed in to that account. If this was not you, ignore this email: nothing changes.
        </p>
      </div>
    `,
  });
  if (error) throw new Error(`Resend rejected the email change link: ${error.message}`);
}

/** Tells the address an account just left that it has moved. Plain text: it carries an address someone typed. */
export async function sendEmailChangedNotice(oldAddress: string, newAddress: string): Promise<void> {
  const { error } = await getResendClient().emails.send({
    from: FROM_ADDRESS,
    to: oldAddress,
    subject: "Your Booklet email address was changed",
    text: [
      `The email address of your Booklet account was changed to ${newAddress}.`,
      "",
      "If you did this, there is nothing to do.",
      "If you did not, someone else has been in your account. Sign in, change the address back, then change your password. If you can no longer sign in, write to whoever runs this Booklet: this address can no longer reset the password.",
    ].join("\n"),
  });
  if (error) throw new Error(`Resend rejected the email change notice: ${error.message}`);
}

/**
 * An invite to a team space, to the address it was made for. Plain text: the
 * space's name and the inviter's address are both written by a user.
 *
 * Returns false, and sends nothing, when RESEND_API_KEY is unset: the
 * owner is shown the link either way and can send it themselves.
 */
export async function sendTeamInviteEmail(to: string, invite: { spaceName: string; invitedBy: string | null; joinUrl: string }): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false;
  const { error } = await getResendClient().emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `Join the ${invite.spaceName} space on Booklet`.slice(0, 180),
    text: [
      `${invite.invitedBy ?? "The owner"} invited you to the ${invite.spaceName} team space on Booklet.`,
      "",
      `Join: ${invite.joinUrl}`,
      "",
      "The link works for 72 hours, and only for an account with this email address. Sign in or create that account when asked.",
      "If you were not expecting this, ignore this email: nothing happens unless you open the link.",
    ].join("\n"),
  });
  if (error) throw new Error(`Resend rejected the team invite: ${error.message}`);
  return true;
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

const escapeHtml = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** One error the app logged, to whoever runs this install (ERROR_ALERT_EMAIL). Plain text: a stack is not prose. */
export async function sendErrorAlertEmail(
  to: string,
  event: { scope: string; message: string; errorMessage: string | null; stack: string | null; count: number; firstSeen: Date },
): Promise<void> {
  const lines = [
    `${event.scope}: ${event.message}`,
    event.errorMessage ? `Error: ${event.errorMessage}` : null,
    `Seen ${event.count} time${event.count === 1 ? "" : "s"} since ${event.firstSeen.toISOString()}.`,
    "",
    event.stack ?? "(no stack)",
    "",
    "Every error from the last 30 days is listed at /admin. This one will not be mailed again for 24 hours.",
  ].filter((l): l is string => l !== null);
  const { error } = await getResendClient().emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `Booklet error: ${event.scope}: ${event.message}`.slice(0, 180),
    text: lines.join("\n"),
    html: `<pre style="font-family: ui-monospace, monospace; font-size: 13px; white-space: pre-wrap;">${escapeHtml(lines.join("\n"))}</pre>`,
  });
  if (error) throw new Error(`Resend rejected the error alert: ${error.message}`);
}
