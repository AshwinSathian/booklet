import { AppLogo } from "@/components/ui/AppLogo";
import { GONE_MESSAGES, type GoneReason } from "@/lib/gone-notice";

/**
 * Rendered by the share and embed pages in place of a page that was taken
 * down or has expired. Normally the middleware has already answered 410 and
 * this never renders; it is the guarantee that the content stays hidden
 * even if that check fails open.
 */
export function GoneNotice({ reason, embed = false }: { reason: GoneReason; embed?: boolean }) {
  if (embed) {
    return (
      <div className="flex min-h-50 items-center justify-center bg-bg text-center p-8">
        <p className="text-sm text-text-muted">{GONE_MESSAGES[reason]}</p>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      <header className="border-b border-border-subtle">
        <div className="mx-auto w-full max-w-2xl px-4 py-3">
          <AppLogo onlyIcon={false} />
        </div>
      </header>
      <main className="flex-1 px-4 py-16">
        <p className="mx-auto max-w-xl text-sm text-text-secondary leading-relaxed">{GONE_MESSAGES[reason]}</p>
      </main>
    </div>
  );
}
