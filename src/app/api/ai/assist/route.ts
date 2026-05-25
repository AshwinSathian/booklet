import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_INPUT_CHARS = 20_000;
const MAX_PROMPT_CHARS = 500;

function getClientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return "unknown";
}

const ACTIONS: Record<string, string> = {
  improve: "Improve the clarity, structure, and readability of this markdown document. Keep the same meaning and all the content — just make it better written. Return only the improved markdown, no explanations.",
  summarize: "Write a concise summary section for this markdown document. Return only the summary as markdown (2-4 sentences), no explanations.",
  intro: "Write a brief introduction paragraph for this markdown document. Return only the introduction as markdown, no explanations.",
  conclusion: "Write a brief conclusion or next steps section for this markdown document. Return only the conclusion as markdown, no explanations.",
  grammar: "Fix all spelling, grammar, and punctuation errors in this markdown document. Keep everything else identical. Return only the corrected markdown, no explanations.",
  shorten: "Shorten this markdown document significantly while keeping all key points. Return only the shortened markdown, no explanations.",
  expand: "Expand this markdown document with more detail and examples. Keep the same structure but make each section more thorough. Return only the expanded markdown, no explanations.",
};

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI assist is not configured" }, { status: 503 });
  }

  const ip = getClientIp(req);
  const rl = await checkRateLimit(`ai_assist__${ip}`, 10).catch(() => null);
  if (rl) return rl;

  let body: { raw?: string; prompt?: string; action?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = (body.raw ?? "").slice(0, MAX_INPUT_CHARS);
  const userPrompt = (body.prompt ?? "").slice(0, MAX_PROMPT_CHARS).trim();
  const action = body.action ?? "custom";

  if (!raw.trim()) {
    return NextResponse.json({ error: "No content to work with" }, { status: 400 });
  }

  const systemPrompt = action !== "custom" && ACTIONS[action]
    ? ACTIONS[action]
    : `You are a writing assistant. The user is working on a markdown document. Follow their instruction exactly. Return only the result — no explanations, no preamble, no markdown code fence. If you are returning a full document, return only the document content.`;

  const userMessage = action !== "custom" && ACTIONS[action]
    ? `Here is the document:\n\n${raw}`
    : `Instruction: ${userPrompt}\n\nDocument:\n\n${raw}`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const messageStream = anthropic.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4096,
          messages: [{ role: "user", content: userMessage }],
          system: systemPrompt,
        });

        for await (const chunk of messageStream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "AI error";
        controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
