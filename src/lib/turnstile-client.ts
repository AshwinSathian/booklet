"use client";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
};

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
let script: Promise<TurnstileApi> | null = null;

function load(): Promise<TurnstileApi> {
  script ??= new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    el.async = true;
    el.onload = () => resolve((window as unknown as { turnstile: TurnstileApi }).turnstile);
    el.onerror = () => {
      script = null;
      reject(new Error("Could not load the robot check. Check your connection and try again."));
    };
    document.head.appendChild(el);
  });
  return script;
}

/**
 * A fresh Turnstile token for one form submission, or undefined when
 * Turnstile is not configured. The widget stays invisible unless Cloudflare
 * decides the visitor has to interact with it, in which case it appears in
 * the bottom corner of the page.
 */
export async function getTurnstileToken(): Promise<string | undefined> {
  if (!SITE_KEY) return undefined;
  const turnstile = await load();
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;bottom:16px;right:16px;z-index:1000";
  document.body.appendChild(host);
  return new Promise<string>((resolve, reject) => {
    const fail = () => done(() => reject(new Error("The robot check did not finish. Reload the page and try again.")));
    const id = turnstile.render(host, {
      sitekey: SITE_KEY,
      appearance: "interaction-only",
      callback: (token: string) => done(() => resolve(token)),
      "error-callback": fail,
      "timeout-callback": fail,
      "expired-callback": fail,
      "unsupported-callback": fail,
    });
    // The widget can ask for a click and never get one. Two minutes is
    // long enough to notice it in the corner and short enough that the
    // form does not stay busy for good.
    const timer = window.setTimeout(fail, 120_000);
    let settled = false;
    function done(settle: () => void) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      turnstile.remove(id);
      host.remove();
      settle();
    }
  });
}
