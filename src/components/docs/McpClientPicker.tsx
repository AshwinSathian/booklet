"use client";

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
    <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">
      {n}
    </span>
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
        "p-1.5 rounded-md transition text-text-muted hover:text-text-primary hover:bg-bg-elevated border border-transparent hover:border-border-default",
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
        <div className="flex items-center justify-between px-3 py-1.5 bg-bg-soft border border-border-default rounded-t-xl border-b-0">
          <span className="text-xs font-mono text-text-muted">{label}</span>
          <CopyButton text={code} />
        </div>
      )}
      <div className="relative">
        <pre tabIndex={0} className={cn(
          "text-[12px] font-mono bg-bg-soft border border-border-default p-4 text-text-secondary overflow-x-auto leading-relaxed whitespace-pre",
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
  { id: "claude-ai", label: "Claude.ai", badge: "Pro / Max", icon: <ClaudeSparkIcon /> },
  { id: "claude-desktop", label: "Claude Desktop", icon: <ClaudeSparkIcon /> },
  { id: "cursor", label: "Cursor", icon: <CursorIcon /> },
  { id: "windsurf", label: "Windsurf", icon: <WindsurfIcon /> },
  { id: "vscode", label: "VS Code", icon: <VSCodeIcon /> },
  { id: "zed", label: "Zed", icon: <ZedIcon /> },
];

// ─── Config snippets ──────────────────────────────────────────────────────────

function makeDesktopConfig(key = "bklt_YOUR_API_KEY") {
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

function makeCursorConfig(key = "bklt_YOUR_API_KEY") {
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

function makeVSCodeConfig(key = "bklt_YOUR_API_KEY") {
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

function makeZedConfig(key = "bklt_YOUR_API_KEY") {
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
      <div className="flex items-center gap-1 p-0.5 bg-bg-soft border border-border-default rounded-lg w-fit">
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

function ClaudeAiInstructions() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/30 text-warning text-xs">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" aria-hidden className="shrink-0">
          <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Remote MCP on Claude.ai requires a <strong className="mx-0.5">Claude Pro</strong> or{" "}
        <strong>Max</strong> plan.
      </div>

      <div className="space-y-4">
        <Step n={1} title="Add the connector">
          <p className="text-sm text-text-secondary mb-2">
            Go to{" "}
            <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
              claude.ai
            </a>{" "}
            → <strong>Settings</strong> → <strong>Connectors</strong> → <strong>Add custom connector</strong>, and
            enter:
          </p>
          <div className="rounded-xl border border-border-default bg-bg-soft p-4 space-y-3 text-sm">
            <Field label="Name" value="Booklet" />
            <Field label="Remote MCP server URL" value={MCP_URL} copyable />
          </div>
        </Step>

        <Step n={2} title="Sign in">
          <p className="text-sm text-text-secondary">
            Click <strong>Connect</strong>. Claude opens Booklet in your browser. Sign in if you are not already,
            check that the screen names Claude and what it is asking for, and click <strong>Allow</strong>. You
            are sent back to Claude, connected.
          </p>
        </Step>

        <Step n={3} title="Start a new conversation">
          <p className="text-sm text-text-secondary">
            Open a new chat and ask: <Code>What Booklet tools do you have?</Code>
          </p>
          <p className="text-sm text-text-secondary mt-2">
            Claude keeps its access until you remove the connector in Claude&apos;s settings. Resetting your
            Booklet password also disconnects it.
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
          <div className="rounded-xl border border-border-default bg-bg-soft p-4 space-y-3 text-sm">
            <Field label="Server name" value="booklet" />
            <Field label="Server URL" value={MCP_URL} copyable />
            <Field label="Authorization" value={headerValue} copyable masked={apiKey === "bklt_YOUR_API_KEY"} />
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
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-info/10 border border-info/20 text-info text-xs">
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
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-info/10 border border-info/20 text-info text-xs">
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
        <div className="w-px flex-1 bg-fill-2/60 min-h-3" />
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

// ─── Main page ────────────────────────────────────────────────────────────────

// ─── The picker ───────────────────────────────────────────────────────────────

/**
 * Setup steps for one MCP client at a time. Embedded in the MCP guide
 * (content/docs/guides/mcp.md) with a ```booklet-embed block. A pasted API
 * key is filled into the config shown; it stays in the browser.
 */
export function McpClientPicker() {
  const [platform, setPlatform] = useState<PlatformId>("claude-ai");
  const [apiKey, setApiKey] = useState("bklt_YOUR_API_KEY");
  const label = PLATFORMS.find((p) => p.id === platform)?.label;

  const platformContent: Record<PlatformId, ReactNode> = {
    "claude-desktop": <ClaudeDesktopInstructions apiKey={apiKey} />,
    "claude-ai": <ClaudeAiInstructions />,
    cursor: <CursorInstructions apiKey={apiKey} />,
    windsurf: <WindsurfInstructions apiKey={apiKey} />,
    vscode: <VSCodeInstructions apiKey={apiKey} />,
    zed: <ZedInstructions apiKey={apiKey} />,
  };

  return (
    <div className="my-2 rounded-xl border border-border-default bg-bg-elevated p-5 sm:p-6">
      <div role="tablist" aria-label="MCP client" className="mb-6 flex flex-wrap gap-1.5">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={platform === p.id}
            onClick={() => setPlatform(p.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium",
              platform === p.id
                ? "border-accent bg-accent text-accent-contrast"
                : "border-border-strong bg-bg text-text-secondary hover:border-accent hover:text-text-primary",
            )}
          >
            <span aria-hidden>{p.icon}</span>
            {p.label}
            {p.badge && <span className="ml-0.5 rounded bg-highlight px-1 py-0.5 text-xs font-semibold text-on-highlight">{p.badge}</span>}
          </button>
        ))}
      </div>

      {platform !== "claude-ai" && (
        <div className="mb-6 border-b border-border-default pb-6">
          <p className="text-sm text-text-secondary">
            {label} sends a Booklet API key with each request. Create one under{" "}
            <Link href={ROUTES.apiKeys} className="text-text-primary underline underline-offset-2">
              Settings, API keys
            </Link>
            . It starts with <Code>bklt_</Code> and is shown once.
          </p>
          <label className="mt-4 block text-sm font-medium text-text-primary" htmlFor="mcp-api-key">
            Paste the key to fill it into the config below (optional)
          </label>
          <input
            id="mcp-api-key"
            type="text"
            onChange={(e) => setApiKey(e.target.value.trim() || "bklt_YOUR_API_KEY")}
            placeholder="bklt_YOUR_API_KEY"
            spellCheck={false}
            autoComplete="off"
            className="mt-1.5 w-full rounded-lg border border-border-strong bg-bg px-3 py-2 font-mono text-sm text-text-primary placeholder:text-text-muted"
          />
          <p className="mt-1.5 text-xs text-text-muted">The key stays in this browser tab. It is not sent to Booklet from this page.</p>
        </div>
      )}

      {platformContent[platform]}
    </div>
  );
}
