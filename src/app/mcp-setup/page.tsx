"use client";

import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { ROUTES } from "@/lib/constants";
import Link from "next/link";
import { useState, useCallback, type ReactNode } from "react";

// ─── Shared primitives ────────────────────────────────────────────────────────

function cn(...cls: (string | false | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded px-1.5 py-0.5 text-[0.8em] font-mono bg-fill-2 text-accent-soft break-all">
      {children}
    </code>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-[11px] font-bold flex items-center justify-center">
      {n}
    </span>
  );
}

function SectionAnchor({ id, title }: { id: string; title: string }) {
  return (
    <h2
      id={id}
      className="scroll-mt-20 text-base font-semibold text-text-primary mb-4 pb-2 border-b border-outline flex items-center gap-2"
    >
      {title}
    </h2>
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "Copied!" : "Copy"}
      className={cn(
        "p-1.5 rounded-md transition text-text-muted hover:text-text-primary hover:bg-bg-elevated border border-transparent hover:border-outline",
        className,
      )}
    >
      {copied ? (
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" aria-hidden>
          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" aria-hidden>
          <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      )}
    </button>
  );
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="relative group">
      {label && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-bg-soft border border-outline rounded-t-xl border-b-0">
          <span className="text-[11px] font-mono text-text-muted">{label}</span>
          <CopyButton text={code} />
        </div>
      )}
      <div className="relative">
        <pre className={cn(
          "text-[12px] font-mono bg-bg-soft border border-outline p-4 text-text-secondary overflow-x-auto leading-relaxed whitespace-pre",
          label ? "rounded-b-xl rounded-t-none" : "rounded-xl",
        )}>
          {code}
        </pre>
        {!label && (
          <CopyButton text={code} className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 bg-bg-soft" />
        )}
      </div>
    </div>
  );
}

function InlineCode({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "Copied!" : "Click to copy"}
      className="group inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[0.8em] bg-fill-2 text-accent-soft hover:bg-accent/10 transition cursor-pointer"
    >
      <span className="break-all">{text}</span>
      <span className="shrink-0 text-text-muted group-hover:text-accent transition">
        {copied ? (
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" aria-hidden>
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" aria-hidden>
            <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2" />
          </svg>
        )}
      </span>
    </button>
  );
}

// ─── Platform icons ───────────────────────────────────────────────────────────

function ClaudeSparkIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      />
    </svg>
  );
}

function CursorIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 3l14 9-7 2-2 7L5 3z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WindsurfIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 19c4-8 10-12 16-12M3 13c3-5 8-8 14-8M3 7c2-3 6-5 10-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function VSCodeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M17 3L7 13.5 3 10l-1 1.5 5 4.5 1-1L17 5V3zM7 13.5L17 21l1-2-8.5-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 3v18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ZedIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7.5 8h9L7.5 16h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TerminalIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 9l3 3-3 3M13 15h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Platform data ────────────────────────────────────────────────────────────

const MCP_URL = "https://booklet-mcp.ashwinsathian.com/mcp";

type PlatformId = "claude-desktop" | "claude-ai" | "cursor" | "windsurf" | "vscode" | "zed";

interface Platform {
  id: PlatformId;
  label: string;
  badge?: string;
  icon: ReactNode;
}

const PLATFORMS: Platform[] = [
  { id: "claude-desktop", label: "Claude Desktop", icon: <ClaudeSparkIcon /> },
  { id: "claude-ai", label: "Claude.ai", badge: "Pro / Max", icon: <ClaudeSparkIcon /> },
  { id: "cursor", label: "Cursor", icon: <CursorIcon /> },
  { id: "windsurf", label: "Windsurf", icon: <WindsurfIcon /> },
  { id: "vscode", label: "VS Code", icon: <VSCodeIcon /> },
  { id: "zed", label: "Zed", icon: <ZedIcon /> },
];

// ─── Config snippets ──────────────────────────────────────────────────────────

function makeDesktopConfig(key = "rdbl_YOUR_API_KEY") {
  return JSON.stringify(
    {
      mcpServers: {
        booklet: {
          url: MCP_URL,
          headers: { Authorization: `Bearer ${key}` },
        },
      },
    },
    null,
    2,
  );
}

function makeCursorConfig(key = "rdbl_YOUR_API_KEY") {
  return JSON.stringify(
    {
      mcpServers: {
        booklet: {
          url: MCP_URL,
          headers: { Authorization: `Bearer ${key}` },
        },
      },
    },
    null,
    2,
  );
}

function makeVSCodeConfig(key = "rdbl_YOUR_API_KEY") {
  return JSON.stringify(
    {
      servers: {
        booklet: {
          type: "http",
          url: MCP_URL,
          headers: { Authorization: `Bearer ${key}` },
        },
      },
    },
    null,
    2,
  );
}

function makeZedConfig(key = "rdbl_YOUR_API_KEY") {
  return JSON.stringify(
    {
      context_servers: {
        booklet: {
          source: "custom",
          command: {
            path: "npx",
            args: ["-y", "mcp-remote@latest", MCP_URL, "--header", `Authorization: Bearer ${key}`],
          },
        },
      },
    },
    null,
    2,
  );
}

// ─── Platform instructions ────────────────────────────────────────────────────

function ClaudeDesktopInstructions({ apiKey }: { apiKey: string }) {
  const [os, setOs] = useState<"mac" | "windows">("mac");
  const config = makeDesktopConfig(apiKey);

  const configPath =
    os === "mac"
      ? "~/Library/Application Support/Claude/claude_desktop_config.json"
      : "%APPDATA%\\Claude\\claude_desktop_config.json";

  return (
    <div className="space-y-5">
      {/* OS toggle */}
      <div className="flex items-center gap-1 p-0.5 bg-bg-soft border border-outline rounded-lg w-fit">
        {(["mac", "windows"] as const).map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setOs(o)}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-md transition",
              os === o
                ? "bg-bg-elevated text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary",
            )}
          >
            {o === "mac" ? "macOS" : "Windows"}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <Step n={1} title="Open the config file">
          <p className="text-sm text-text-secondary">
            Open or create this file in a text editor:
          </p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <InlineCode text={configPath} />
          </div>
          {os === "mac" && (
            <p className="text-xs text-text-muted mt-2">
              Tip: Press <Code>⌘ Space</Code>, type <Code>Terminal</Code>, then run{" "}
              <Code>open -e &quot;{configPath}&quot;</Code> to open it directly.
            </p>
          )}
        </Step>

        <Step n={2} title="Add the Booklet server">
          <p className="text-sm text-text-secondary mb-2">
            Paste this into the file. If the file already has <Code>mcpServers</Code>, add the{" "}
            <Code>booklet</Code> entry inside the existing object.
          </p>
          <CodeBlock code={config} label="claude_desktop_config.json" />
        </Step>

        <Step n={3} title="Save and restart Claude Desktop">
          <p className="text-sm text-text-secondary">
            Fully quit Claude Desktop (not just close the window) and relaunch it. The MCP server
            connects at startup.
          </p>
        </Step>

        <Step n={4} title="Verify the connection">
          <p className="text-sm text-text-secondary">
            In a new conversation, look for the{" "}
            <span className="font-medium text-text-primary">plug icon</span> (⚡ or 🔌) near the
            input box. Click it — <strong>booklet</strong> should appear in the list of connected
            servers.
          </p>
        </Step>
      </div>
    </div>
  );
}

function ClaudeAiInstructions({ apiKey }: { apiKey: string }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" aria-hidden className="shrink-0">
          <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Remote MCP on Claude.ai requires a <strong className="mx-0.5">Claude Pro</strong> or{" "}
        <strong>Max</strong> plan.
      </div>

      <div className="space-y-4">
        <Step n={1} title="Open Claude Settings">
          <p className="text-sm text-text-secondary">
            Go to{" "}
            <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              claude.ai
            </a>{" "}
            → click your avatar (top-right) → <strong>Settings</strong> →{" "}
            <strong>Integrations</strong>.
          </p>
        </Step>

        <Step n={2} title="Add a new MCP server">
          <p className="text-sm text-text-secondary mb-2">
            Click <strong>Add integration</strong> and fill in the form:
          </p>
          <div className="rounded-xl border border-outline bg-bg-soft p-4 space-y-3 text-sm">
            <Field label="Integration name" value="Booklet" />
            <Field label="MCP server URL" value={MCP_URL} copyable />
            <Field
              label="Authorization header"
              value={`Bearer ${apiKey}`}
              copyable
              masked={apiKey === "rdbl_YOUR_API_KEY"}
            />
          </div>
        </Step>

        <Step n={3} title="Save and start a new conversation">
          <p className="text-sm text-text-secondary">
            Click <strong>Save</strong>. Open a new chat — the Booklet tools will be available
            automatically. You can confirm by asking:{" "}
            <Code>What Booklet tools do you have?</Code>
          </p>
        </Step>
      </div>
    </div>
  );
}

function CursorInstructions({ apiKey }: { apiKey: string }) {
  const config = makeCursorConfig(apiKey);

  return (
    <div className="space-y-5">
      <p className="text-sm text-text-secondary">
        Cursor supports remote MCP servers natively. You can configure it globally (all projects)
        or per-project.
      </p>

      <div className="space-y-4">
        <Step n={1} title="Open MCP settings">
          <p className="text-sm text-text-secondary">
            <strong>Option A — UI:</strong> Open Cursor → <Code>⌘ ,</Code> (Settings) →{" "}
            <strong>MCP</strong> → <strong>Add new global MCP server</strong>.
          </p>
          <p className="text-sm text-text-secondary mt-2">
            <strong>Option B — file:</strong> Create or edit the config file directly:
          </p>
          <div className="mt-1.5 space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-text-muted w-16 shrink-0">Global</span>
              <InlineCode text="~/.cursor/mcp.json" />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-text-muted w-16 shrink-0">Project</span>
              <InlineCode text=".cursor/mcp.json" />
            </div>
          </div>
        </Step>

        <Step n={2} title="Add the config">
          <CodeBlock code={config} label="mcp.json" />
        </Step>

        <Step n={3} title="Reload Cursor">
          <p className="text-sm text-text-secondary">
            Cursor auto-detects config changes, but if the server doesn&apos;t appear, open the Command
            Palette (<Code>⌘ ⇧ P</Code>) and run{" "}
            <Code>MCP: Reload servers</Code>.
          </p>
        </Step>

        <Step n={4} title="Verify">
          <p className="text-sm text-text-secondary">
            In Cursor Chat, click the <strong>Tools</strong> icon and confirm{" "}
            <strong>booklet</strong> is listed.
          </p>
        </Step>
      </div>
    </div>
  );
}

function WindsurfInstructions({ apiKey }: { apiKey: string }) {
  const headerValue = `Bearer ${apiKey}`;

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <Step n={1} title="Open Cascade MCP settings">
          <p className="text-sm text-text-secondary">
            In Windsurf, click the <strong>hamburger menu (☰)</strong> → <strong>Settings</strong>{" "}
            → <strong>Cascade</strong> → scroll to <strong>MCP Servers</strong>.
          </p>
          <p className="text-sm text-text-secondary mt-2">
            Alternatively, click the <strong>hammer icon</strong> in the Cascade panel and select{" "}
            <strong>Configure</strong>.
          </p>
        </Step>

        <Step n={2} title="Add a new HTTP server">
          <p className="text-sm text-text-secondary mb-2">
            Click <strong>+ Add Server</strong> → choose <strong>HTTP/SSE</strong> and fill in:
          </p>
          <div className="rounded-xl border border-outline bg-bg-soft p-4 space-y-3 text-sm">
            <Field label="Server name" value="booklet" />
            <Field label="Server URL" value={MCP_URL} copyable />
            <Field label="Authorization" value={headerValue} copyable masked={apiKey === "rdbl_YOUR_API_KEY"} />
          </div>
        </Step>

        <Step n={3} title="Save and verify">
          <p className="text-sm text-text-secondary">
            Click <strong>Save</strong>. The server status should turn green. In a new Cascade
            conversation, try: <Code>List my Booklet pages</Code>
          </p>
        </Step>
      </div>
    </div>
  );
}

function VSCodeInstructions({ apiKey }: { apiKey: string }) {
  const config = makeVSCodeConfig(apiKey);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" aria-hidden className="shrink-0">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
          <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Requires VS Code <strong className="mx-0.5">1.99+</strong> with the{" "}
        <strong>GitHub Copilot</strong> extension.
      </div>

      <div className="space-y-4">
        <Step n={1} title="Create the MCP config file">
          <p className="text-sm text-text-secondary mb-2">
            Create <Code>.vscode/mcp.json</Code> in your project root (or open it if it already
            exists):
          </p>
          <CodeBlock code={config} label=".vscode/mcp.json" />
          <p className="text-sm text-text-muted mt-2">
            For a global config (all projects), add this to your User Settings JSON instead
            under the key <Code>mcp.servers</Code>.
          </p>
        </Step>

        <Step n={2} title="Enable MCP in Copilot Chat">
          <p className="text-sm text-text-secondary">
            VS Code detects the file automatically. Open Copilot Chat (<Code>⌘ ⌥ I</Code>) and
            switch to <strong>Agent mode</strong> (the @ icon). Click{" "}
            <strong>Select tools</strong> — <strong>booklet</strong> should be listed.
          </p>
        </Step>

        <Step n={3} title="Approve on first use">
          <p className="text-sm text-text-secondary">
            The first time you use a Booklet tool, VS Code will prompt you to approve it. Click{" "}
            <strong>Allow</strong> (or <strong>Allow always</strong> to skip future prompts).
          </p>
        </Step>
      </div>
    </div>
  );
}

function ZedInstructions({ apiKey }: { apiKey: string }) {
  const config = makeZedConfig(apiKey);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" aria-hidden className="shrink-0">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
          <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Zed uses <strong className="mx-0.5">mcp-remote</strong> as a bridge for HTTP MCP servers.
        Node.js 18+ required.
      </div>

      <div className="space-y-4">
        <Step n={1} title="Edit your Zed settings">
          <p className="text-sm text-text-secondary mb-2">
            Open Zed → <Code>⌘ ,</Code> → <strong>Open Local Settings</strong> (or edit{" "}
            <InlineCode text="~/.config/zed/settings.json" /> directly). Add the following to the
            root JSON object:
          </p>
          <CodeBlock code={config} label="~/.config/zed/settings.json" />
        </Step>

        <Step n={2} title="Save and open the AI assistant">
          <p className="text-sm text-text-secondary">
            Save the file. Zed reloads settings automatically. Open the AI panel (<Code>⌘ ?</Code>)
            and start a new conversation — <Code>mcp-remote</Code> will be fetched on first use.
          </p>
        </Step>

        <Step n={3} title="Verify">
          <p className="text-sm text-text-secondary">
            Ask the assistant: <Code>List my Booklet pages</Code>. Zed should invoke the{" "}
            <strong>list_pages</strong> tool and return your pages.
          </p>
        </Step>
      </div>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center gap-1 pt-0.5">
        <StepNumber n={n} />
        <div className="w-px flex-1 bg-outline/60 min-h-3" />
      </div>
      <div className="pb-2 min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-primary mb-1.5">{title}</p>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  copyable,
  masked,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  masked?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-text-muted text-xs w-36 shrink-0 mt-0.5">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        {masked ? (
          <span className="text-xs text-text-muted italic">paste your API key here</span>
        ) : copyable ? (
          <InlineCode text={value} />
        ) : (
          <Code>{value}</Code>
        )}
      </div>
    </div>
  );
}

// ─── Prompt chip ──────────────────────────────────────────────────────────────

function PromptChip({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      type="button"
      onClick={copy}
      className="group flex items-start gap-2 rounded-xl border border-outline bg-bg-elevated px-4 py-3 text-left text-sm text-text-secondary transition hover:border-accent/40 hover:bg-bg-soft hover:text-text-primary"
    >
      <svg
        width="14"
        height="14"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden
        className="mt-0.5 shrink-0 text-text-muted group-hover:text-accent transition"
      >
        {copied ? (
          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <>
            <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.7" />
          </>
        )}
      </svg>
      <span>{text}</span>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function McpSetupPage() {
  const [platform, setPlatform] = useState<PlatformId>("claude-desktop");
  const [apiKey, setApiKey] = useState("rdbl_YOUR_API_KEY");

  const platformContent: Record<PlatformId, ReactNode> = {
    "claude-desktop": <ClaudeDesktopInstructions apiKey={apiKey} />,
    "claude-ai": <ClaudeAiInstructions apiKey={apiKey} />,
    cursor: <CursorInstructions apiKey={apiKey} />,
    windsurf: <WindsurfInstructions apiKey={apiKey} />,
    vscode: <VSCodeInstructions apiKey={apiKey} />,
    zed: <ZedInstructions apiKey={apiKey} />,
  };

  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      {/* Header */}
      <SiteHeader ctaTrackLocation="mcp_setup_topbar" />

      <div className="flex-1 mx-auto w-full max-w-5xl px-4 py-10 flex gap-10">
        {/* Sidebar */}
        <aside className="hidden lg:block shrink-0 w-44 sticky top-24 self-start">
          <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-text-muted mb-3">
            On this page
          </p>
          <nav className="flex flex-col gap-1 text-xs">
            {[
              ["#overview", "Overview"],
              ["#api-key", "Get your API key"],
              ["#connect", "Connect to your tool"],
              ["#prompts", "Try it out"],
              ["#tools", "Available tools"],
              ["#templates", "Templates"],
              ["#troubleshoot", "Troubleshooting"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="text-text-muted hover:text-text-primary transition py-0.5"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="mt-8 pt-6 border-t border-outline">
            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-text-muted mb-2">
              MCP endpoint
            </p>
            <CopyButton text={MCP_URL} className="w-full justify-center text-[11px] font-mono text-text-muted hover:text-text-primary" />
            <p className="text-[11px] font-mono text-text-muted break-all mt-1 leading-snug">
              {MCP_URL}
            </p>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 flex flex-col gap-12">
          {/* Overview */}
          <section id="overview" className="scroll-mt-20">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
                <ClaudeSparkIcon size={20} />
              </div>
              <div>
                <h1 className="text-[clamp(20px,3vw,26px)] mb-1">
                  Connect Booklet to your AI
                </h1>
                <p className="text-sm text-text-secondary max-w-prose">
                  Booklet&apos;s MCP server lets Claude, Cursor, Windsurf, and other AI tools publish,
                  update, and manage your pages — entirely through conversation. One-time setup, no
                  copy-pasting.
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  icon: <TerminalIcon size={15} />,
                  title: "Say it, publish it",
                  body: "\"Publish this as a Booklet page\" — done.",
                },
                {
                  icon: (
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" aria-hidden>
                      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                  title: "Edit in place",
                  body: "Update any page by ID or slug, right from chat.",
                },
                {
                  icon: (
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" aria-hidden>
                      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                  title: "5 pre-built templates",
                  body: "Incident reports, ADRs, RFCs, runbooks, release notes.",
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="rounded-xl border border-outline bg-bg-elevated p-4 flex flex-col gap-2"
                >
                  <div className="text-accent">{card.icon}</div>
                  <p className="text-sm font-semibold text-text-primary">{card.title}</p>
                  <p className="text-xs text-text-secondary leading-relaxed">{card.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Step 1 — API Key */}
          <section id="api-key" className="scroll-mt-20">
            <SectionAnchor id="" title="Step 1 — Get your API key" />

            <p className="text-sm text-text-secondary mb-4">
              Every MCP request is authenticated with a Booklet API key. The key identifies you and
              scopes all operations to your pages.
            </p>

            <div className="space-y-4">
              <Step n={1} title="Go to My Pages → API Keys">
                <p className="text-sm text-text-secondary">
                  <Link href={ROUTES.myPages} className="text-accent hover:underline">
                    Open My Pages
                  </Link>{" "}
                  → scroll to the <strong>API Keys</strong> section.
                </p>
              </Step>

              <Step n={2} title="Generate a new key">
                <p className="text-sm text-text-secondary">
                  Click <strong>Generate key</strong>, give it a label like{" "}
                  <Code>claude-mcp</Code> or <Code>cursor</Code>, and copy the key immediately. It
                  starts with <Code>rdbl_</Code> and is shown only once.
                </p>
              </Step>

              <Step n={3} title="Paste it below (optional — personalises all snippets on this page)">
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setApiKey(v || "rdbl_YOUR_API_KEY");
                    }}
                    placeholder="rdbl_YOUR_API_KEY"
                    spellCheck={false}
                    className="flex-1 rounded-lg border border-outline bg-bg-soft px-3 py-2 text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50 transition"
                  />
                </div>
                {apiKey !== "rdbl_YOUR_API_KEY" && (
                  <p className="text-xs text-accent mt-1.5">
                    ✓ All config snippets on this page now include your key.
                  </p>
                )}
                <p className="text-xs text-text-muted mt-1">
                  This value stays in your browser and is never sent to Booklet servers.
                </p>
              </Step>
            </div>
          </section>

          {/* Step 2 — Connect */}
          <section id="connect" className="scroll-mt-20">
            <SectionAnchor id="" title="Step 2 — Connect to your AI tool" />

            {/* Platform tabs */}
            <div className="flex flex-wrap gap-1.5 mb-6">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlatform(p.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition border",
                    platform === p.id
                      ? "bg-accent/10 border-accent/40 text-accent"
                      : "border-outline text-text-muted hover:border-accent/20 hover:text-text-secondary bg-bg-elevated",
                  )}
                >
                  <span className="opacity-80">{p.icon}</span>
                  {p.label}
                  {p.badge && (
                    <span className="ml-0.5 rounded px-1 py-0.5 text-2xs bg-amber-500/15 text-amber-400 font-semibold">
                      {p.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Platform instructions */}
            <div className="rounded-xl border border-outline bg-bg-elevated p-5 sm:p-6">
              {platformContent[platform]}
            </div>
          </section>

          {/* Step 3 — Try it out */}
          <section id="prompts" className="scroll-mt-20">
            <SectionAnchor id="" title="Step 3 — Try it out" />
            <p className="text-sm text-text-secondary mb-4">
              Once connected, try these prompts. Click any chip to copy it.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                "List all my Booklet pages",
                "Publish this as a Booklet page: # Hello World\n\nThis is my first page.",
                "Create an incident report for a database outage that happened today and publish it to Booklet",
                "Write an ADR for switching from REST to GraphQL and publish it",
                "Update my page with slug 'my-page' with this new content: [paste content]",
                "What Booklet tools do you have access to?",
                "Delete the page with ID [page-id]",
                "Create a runbook for deploying our app to production and share the link",
              ].map((prompt) => (
                <PromptChip key={prompt} text={prompt} />
              ))}
            </div>
          </section>

          {/* Tools reference */}
          <section id="tools" className="scroll-mt-20">
            <SectionAnchor id="" title="Available tools" />
            <p className="text-sm text-text-secondary mb-4">
              These tools are available to any connected AI. The AI chooses which one to call based
              on your request.
            </p>
            <div className="overflow-x-auto rounded-xl border border-outline">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-outline bg-bg-soft">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wide">
                      Tool
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wide">
                      What it does
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wide hidden sm:table-cell">
                      Key inputs
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      name: "publish_page",
                      desc: "Create a new Booklet page from Markdown",
                      inputs: "raw (markdown), title, slug, visibility",
                    },
                    {
                      name: "update_page",
                      desc: "Update an existing page's content or metadata",
                      inputs: "id or slug, raw, new slug, visibility",
                    },
                    {
                      name: "get_page",
                      desc: "Fetch a page's metadata and raw Markdown",
                      inputs: "id or slug",
                    },
                    {
                      name: "list_pages",
                      desc: "List your pages with pagination",
                      inputs: "limit, offset",
                    },
                    {
                      name: "delete_page",
                      desc: "Permanently delete a page",
                      inputs: "id",
                    },
                  ].map((tool, i, arr) => (
                    <tr
                      key={tool.name}
                      className={cn("border-outline", i < arr.length - 1 ? "border-b" : "")}
                    >
                      <td className="px-4 py-3 font-mono text-[12px] text-accent-soft whitespace-nowrap">
                        {tool.name}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">{tool.desc}</td>
                      <td className="px-4 py-3 text-xs text-text-muted hidden sm:table-cell">
                        {tool.inputs}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Templates reference */}
          <section id="templates" className="scroll-mt-20">
            <SectionAnchor id="" title="Templates (prompts)" />
            <p className="text-sm text-text-secondary mb-4">
              The MCP server exposes five pre-built Markdown templates. Tell Claude to use one and
              it will fill it with your details before publishing.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                {
                  name: "incident_report",
                  title: "Incident Report",
                  desc: "Timeline, impact, root cause, action items.",
                  example: "Write an incident report for the API outage yesterday",
                },
                {
                  name: "adr",
                  title: "Architecture Decision Record",
                  desc: "Context, decision, consequences, status.",
                  example: "Create an ADR for moving to a monorepo",
                },
                {
                  name: "release_notes",
                  title: "Release Notes",
                  desc: "What's new, fixed, and changed in a release.",
                  example: "Write release notes for v2.1.0",
                },
                {
                  name: "rfc",
                  title: "RFC",
                  desc: "Proposal, motivation, design, alternatives.",
                  example: "Write an RFC for adding real-time collaboration",
                },
                {
                  name: "runbook",
                  title: "Runbook",
                  desc: "Prerequisites, steps, verification, rollback.",
                  example: "Create a runbook for deploying to production",
                },
              ].map((tmpl) => (
                <div
                  key={tmpl.name}
                  className="rounded-xl border border-outline bg-bg-elevated p-4 flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
                    <code className="text-[11px] font-mono text-accent-soft bg-fill-2 rounded px-1.5 py-0.5">
                      {tmpl.name}
                    </code>
                  </div>
                  <p className="text-sm font-semibold text-text-primary">{tmpl.title}</p>
                  <p className="text-xs text-text-secondary leading-relaxed">{tmpl.desc}</p>
                  <PromptChip text={tmpl.example} />
                </div>
              ))}
            </div>
          </section>

          {/* Troubleshooting */}
          <section id="troubleshoot" className="scroll-mt-20">
            <SectionAnchor id="" title="Troubleshooting" />
            <div className="space-y-3">
              {[
                {
                  q: "The server shows as connected but tools aren't working",
                  a: "Check your API key — it must start with rdbl_ and not have been revoked. Go to My Pages → API Keys to verify.",
                },
                {
                  q: "Claude Desktop doesn't show the Booklet server",
                  a: "Make sure you fully quit and relaunched Claude Desktop (not just closed the window). Also verify the JSON in your config file is valid — a single extra comma or brace will break parsing.",
                },
                {
                  q: "Getting \"Unauthorized\" errors",
                  a: "The API key in your config doesn't match what Booklet expects. Re-generate a key from My Pages → API Keys and update the Authorization header value.",
                },
                {
                  q: "Claude says it doesn't have any Booklet tools",
                  a: "For Claude.ai, this feature requires a Pro or Max plan. For Claude Desktop, restart the app after saving the config. For Cursor/Windsurf, check that the server shows as green/connected in their settings.",
                },
                {
                  q: "Zed fails to start the mcp-remote process",
                  a: "Make sure Node.js 18+ is installed and accessible from your shell. Run `node --version` in a terminal to check. mcp-remote is downloaded automatically by npx on first use.",
                },
              ].map((item) => (
                <details
                  key={item.q}
                  className="group rounded-xl border border-outline bg-bg-elevated overflow-hidden"
                >
                  <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer list-none text-sm font-medium text-text-primary hover:bg-bg-soft transition">
                    <span>{item.q}</span>
                    <svg
                      width="14"
                      height="14"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden
                      className="shrink-0 text-text-muted transition-transform group-open:rotate-180"
                    >
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </summary>
                  <div className="px-4 pb-3 text-sm text-text-secondary border-t border-outline/60 pt-3">
                    {item.a}
                  </div>
                </details>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-outline bg-bg-elevated p-4 text-sm">
              <p className="font-semibold text-text-primary mb-1">Security note</p>
              <p className="text-text-secondary text-xs leading-relaxed">
                Your API key is sent directly from the MCP client to Booklet&apos;s API on each tool
                call. The MCP server acts as a stateless proxy and never writes your key to
                persistent storage. To revoke MCP access at any time, delete the key from{" "}
                <Link href={ROUTES.myPages} className="text-accent hover:underline">
                  My Pages → API Keys
                </Link>
                . This takes effect immediately across all connected clients.
              </p>
            </div>
          </section>
        </main>
      </div>

      <SiteFooter />
    </div>
  );
}
