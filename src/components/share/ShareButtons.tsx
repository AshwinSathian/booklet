"use client";

import { useState } from "react";

interface ShareButtonsProps {
  url: string;
  title: string;
}

export function ShareButtons({ url, title }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select a temporary input
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const tweetUrl = `https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  return (
    <div className="flex items-center gap-2 mt-6 pt-5 border-t border-border-subtle print:hidden">
      <span className="text-2xs font-medium uppercase tracking-widest text-text-muted/60 mr-1">Share</span>

      {/* Copy link */}
      <button
        type="button"
        onClick={handleCopy}
        title="Copy link"
        className={[
          "inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-medium transition",
          copied
            ? "border-accent/40 bg-accent/10 text-accent"
            : "border-border-subtle bg-bg-elevated text-text-muted hover:border-accent/30 hover:text-text-primary hover:bg-fill-1",
        ].join(" ")}
      >
        {copied ? (
          <>
            <svg width="11" height="11" fill="none" viewBox="0 0 12 12" aria-hidden>
              <path d="M2 7l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Copied
          </>
        ) : (
          <>
            <svg width="11" height="11" fill="none" viewBox="0 0 12 12" aria-hidden>
              <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M3 8H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v1" stroke="currentColor" strokeWidth="1.3" />
            </svg>
            Copy link
          </>
        )}
      </button>

      {/* X (Twitter) */}
      <a
        href={tweetUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Share on X"
        className="inline-flex items-center gap-1.5 rounded-pill border border-border-subtle bg-bg-elevated px-3 py-1.5 text-xs font-medium text-text-muted transition hover:border-accent/30 hover:text-text-primary hover:bg-fill-1"
      >
        <svg width="11" height="11" viewBox="0 0 300 300" fill="currentColor" aria-label="X" role="img">
          <path d="M178.57 127.15 290.27 0h-26.46l-97.03 110.38L89.34 0H0l117.13 166.93L0 300.25h26.46l102.4-116.59 81.8 116.59h89.34M36.01 19.54H76.66l187.13 262.13h-40.66" />
        </svg>
        Post
      </a>

      {/* LinkedIn */}
      <a
        href={linkedInUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Share on LinkedIn"
        className="inline-flex items-center gap-1.5 rounded-pill border border-border-subtle bg-bg-elevated px-3 py-1.5 text-xs font-medium text-text-muted transition hover:border-accent/30 hover:text-text-primary hover:bg-fill-1"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-label="LinkedIn" role="img">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
        Share
      </a>
    </div>
  );
}
