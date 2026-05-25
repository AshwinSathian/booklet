import { Resend } from "resend";
import { APP_NAME, ROUTES } from "@/lib/constants";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.EMAIL_FROM ?? `${APP_NAME} <hello@readable.ashwinsathian.com>`;

export async function sendWelcomeEmail(to: string, firstName?: string): Promise<void> {
  const name = firstName?.trim() || "there";

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Welcome to ${APP_NAME}`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e8e8ea;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:540px;background:#1a1a1c;border-radius:16px;border:1px solid #2a2a2e;overflow:hidden;">
        <!-- Header -->
        <tr><td style="padding:32px 32px 24px;border-bottom:1px solid #2a2a2e;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:10px;vertical-align:middle;">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="24" height="24" rx="5.5" fill="#6366f1"/>
                  <path d="M 6.5 5 L 6.5 19 M 6.5 5 L 13 5 Q 17 5 17 9 Q 17 13 13 13 L 6.5 13 M 11.5 13 L 17 19"
                    stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </td>
              <td style="vertical-align:middle;font-size:15px;font-weight:600;color:#e8e8ea;">${APP_NAME}</td>
            </tr>
          </table>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;font-size:22px;font-weight:700;color:#f4f4f6;line-height:1.3;">
            Hey ${name}, welcome aboard.
          </p>
          <p style="margin:0 0 24px;font-size:15px;color:#98989f;line-height:1.6;">
            ${APP_NAME} turns Markdown into clean, shareable pages — instantly.
            You now have permanent pages, version history, analytics, API access,
            custom URLs, and more. All free.
          </p>

          <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;width:100%;">
            ${[
              ["Custom URLs", "Give your pages memorable, branded slugs."],
              ["Version history", "Every publish is snapshotted. Roll back any time."],
              ["Analytics", "See views, scroll depth, and referrer data."],
              ["REST API", "Publish from CI/CD, scripts, or your editor."],
            ].map(([title, detail]) => `
              <tr>
                <td style="padding:8px 0;vertical-align:top;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding-right:10px;padding-top:2px;vertical-align:top;">
                        <div style="width:6px;height:6px;border-radius:50%;background:#6366f1;margin-top:5px;"></div>
                      </td>
                      <td>
                        <span style="font-size:14px;font-weight:600;color:#e8e8ea;">${title}</span>
                        <span style="font-size:14px;color:#98989f;"> — ${detail}</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            `).join("")}
          </table>

          <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? "https://readable.ashwinsathian.com"}/app"
            style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 24px;border-radius:100px;">
            Open the editor →
          </a>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid #2a2a2e;">
          <p style="margin:0;font-size:12px;color:#4a4a4f;line-height:1.5;">
            You're receiving this because you signed up for ${APP_NAME}.
            <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? "https://readable.ashwinsathian.com"}/privacy"
              style="color:#6366f1;text-decoration:none;">Privacy policy</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
    `.trim(),
    text: `Hey ${name}, welcome to ${APP_NAME}!\n\nYou now have access to permanent pages, version history, analytics, API access, and custom URLs — all free.\n\nOpen the editor: ${process.env.NEXT_PUBLIC_SITE_URL ?? "https://readable.ashwinsathian.com"}/app`,
  });
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://readable.ashwinsathian.com";

export async function sendExpiryConfirmationEmail(to: string, pageUrl: string): Promise<void> {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Your ${APP_NAME} page is live — expires in 30 days`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e8e8ea;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:540px;background:#1a1a1c;border-radius:16px;border:1px solid #2a2a2e;overflow:hidden;">
        <tr><td style="padding:32px 32px 24px;border-bottom:1px solid #2a2a2e;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:10px;vertical-align:middle;">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="24" height="24" rx="5.5" fill="#6366f1"/>
                  <path d="M 6.5 5 L 6.5 19 M 6.5 5 L 13 5 Q 17 5 17 9 Q 17 13 13 13 L 6.5 13 M 11.5 13 L 17 19"
                    stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </td>
              <td style="vertical-align:middle;font-size:15px;font-weight:600;color:#e8e8ea;">${APP_NAME}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;font-size:22px;font-weight:700;color:#f4f4f6;line-height:1.3;">
            Your page is live ✓
          </p>
          <p style="margin:0 0 20px;font-size:15px;color:#98989f;line-height:1.6;">
            Your anonymous ${APP_NAME} page is published and shareable. We'll remind you before it expires.
          </p>

          <a href="${pageUrl}"
            style="display:inline-block;background:#1e1e22;border:1px solid #2a2a2e;color:#6366f1;text-decoration:none;font-size:13px;font-family:monospace;padding:10px 16px;border-radius:8px;word-break:break-all;margin-bottom:24px;">
            ${pageUrl}
          </a>

          <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;width:100%;background:#161618;border-radius:12px;border:1px solid #2a2a2e;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#e8e8ea;">⏳ Expires in 30 days</p>
              <p style="margin:0;font-size:13px;color:#98989f;line-height:1.5;">
                Anonymous pages are stored for 30 days. Sign in (free) to make this page permanent — same URL, just won't expire.
              </p>
            </td></tr>
          </table>

          <a href="${SITE_URL}${ROUTES.signUp}"
            style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 24px;border-radius:100px;">
            Sign in free to keep it →
          </a>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #2a2a2e;">
          <p style="margin:0;font-size:12px;color:#4a4a4f;line-height:1.5;">
            You requested this notification on ${APP_NAME}. We'll send one more reminder before your page expires.
            <a href="${SITE_URL}/privacy" style="color:#6366f1;text-decoration:none;">Privacy policy</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
    `.trim(),
    text: `Your ${APP_NAME} page is live!\n\nView it here: ${pageUrl}\n\nImportant: anonymous pages expire after 30 days. Sign in free to make it permanent: ${SITE_URL}${ROUTES.signUp}`,
  });
}

export async function sendExpiryReminderEmail(to: string, pageUrl: string, daysLeft: number): Promise<void> {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Your ${APP_NAME} page expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e8e8ea;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:540px;background:#1a1a1c;border-radius:16px;border:1px solid #2a2a2e;overflow:hidden;">
        <tr><td style="padding:32px 32px 24px;border-bottom:1px solid #f59e0b22;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:10px;vertical-align:middle;">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="24" height="24" rx="5.5" fill="#6366f1"/>
                  <path d="M 6.5 5 L 6.5 19 M 6.5 5 L 13 5 Q 17 5 17 9 Q 17 13 13 13 L 6.5 13 M 11.5 13 L 17 19"
                    stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </td>
              <td style="vertical-align:middle;font-size:15px;font-weight:600;color:#e8e8ea;">${APP_NAME}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#f59e0b;text-transform:uppercase;letter-spacing:0.05em;">
            ⚠ Expiry reminder
          </p>
          <p style="margin:0 0 16px;font-size:22px;font-weight:700;color:#f4f4f6;line-height:1.3;">
            Your page expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}
          </p>
          <p style="margin:0 0 20px;font-size:15px;color:#98989f;line-height:1.6;">
            After that, this URL will stop working. Sign in (free) to make it permanent — the URL stays the same.
          </p>

          <a href="${pageUrl}"
            style="display:inline-block;background:#1e1e22;border:1px solid #2a2a2e;color:#6366f1;text-decoration:none;font-size:13px;font-family:monospace;padding:10px 16px;border-radius:8px;word-break:break-all;margin-bottom:24px;">
            ${pageUrl}
          </a>

          <br />
          <a href="${SITE_URL}${ROUTES.signUp}"
            style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 24px;border-radius:100px;">
            Sign in free to keep it →
          </a>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #2a2a2e;">
          <p style="margin:0;font-size:12px;color:#4a4a4f;line-height:1.5;">
            You requested expiry notifications for this ${APP_NAME} page. This is your final reminder.
            <a href="${SITE_URL}/privacy" style="color:#6366f1;text-decoration:none;">Privacy policy</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
    `.trim(),
    text: `Your ${APP_NAME} page expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.\n\nView it: ${pageUrl}\n\nSign in free to make it permanent: ${SITE_URL}${ROUTES.signUp}`,
  });
}
