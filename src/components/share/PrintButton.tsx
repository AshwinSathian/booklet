"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      title="Print / Save as PDF"
      className="hidden sm:flex items-center gap-1.5 rounded-lg border border-outline/70 px-3 py-1.5 text-[11px] font-medium text-text-muted transition hover:border-outline hover:text-text-primary"
    >
      <svg width="13" height="13" fill="none" viewBox="0 0 13 13" aria-hidden>
        <path
          d="M3 4V2h7v2M3 9H1.5A.5.5 0 0 1 1 8.5v-3A.5.5 0 0 1 1.5 5h10a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5H10M3 7h7v4H3V7z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Print
    </button>
  );
}
