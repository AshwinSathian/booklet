import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ACTIONS = ["improve", "fix_grammar", "summarize", "shorten", "expand"] as const;
type Action = (typeof ACTIONS)[number];

const SYSTEM_PROMPTS: Record<Action, string> = {
  improve:
    "You are a writing assistant. Improve the given Markdown text to be clearer, more concise, and better structured. Preserve all Markdown formatting, headings, code blocks, and lists. Return only the improved text, nothing else.",
  fix_grammar:
    "You are a proofreader. Fix all grammar, spelling, and punctuation errors in the given Markdown text. Preserve all Markdown formatting exactly. Return only the corrected text, nothing else.",
  summarize:
    "You are a writing assistant. Summarize the given Markdown text into a short, clear summary using bullet points in Markdown format. Keep it to 3-5 key points. Return only the summary, nothing else.",
  shorten:
    "You are a writing assistant. Shorten the given Markdown text significantly while preserving all key information. Remove redundancy and verbose phrasing. Preserve Markdown formatting. Return only the shortened text, nothing else.",
  expand:
    "You are a writing assistant. Expand the given Markdown text with more detail, examples, and context where appropriate. Preserve and enhance the existing Markdown structure. Return only the expanded text, nothing else.",
};

const ACTION_LABELS: Record<Action, string> = {
  improve: "Improve writing",
  fix_grammar: "Fix grammar",
  summarize: "Summarize",
  shorten: "Make shorter",
  expand: "Make longer",
};

type RequestBody = {
  action: Action;
  text: string;
};

const MAX_INPUT_CHARS = 20_000;

export async function POST(req: Request) {
  // Require authentication — AI features only for signed-in users
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI features not configured" }, { status: 503 });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, text } = body;

  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (text.length > MAX_INPUT_CHARS) {
    return NextResponse.json(
      { error: `Input too long (max ${MAX_INPUT_CHARS} chars)` },
      { status: 400 },
    );
  }

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: SYSTEM_PROMPTS[action],
      messages: [{ role: "user", content: text }],
    });

    const result = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    return NextResponse.json({
      result,
      action,
      label: ACTION_LABELS[action],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `AI request failed: ${msg}` }, { status: 500 });
  }
}
