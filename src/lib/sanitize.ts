import { STORAGE } from "./constants";

export function normalizeInput(raw: string): string {
  const s = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return s.length > STORAGE.maxInputChars
    ? s.slice(0, STORAGE.maxInputChars)
    : s;
}

// A previous `stripDangerousSequences` step ran `<script>...</script>` and
// `on\w+="..."` regexes over the *entire* raw markdown string before
// parsing, including inside fenced code blocks — an author writing a
// legitimate code sample containing a literal `<script>` tag or a JSX
// `onClick="..."` prop had it silently mutilated. It was also redundant:
// src/lib/parse.ts's `removeRawHtmlNodes` already unconditionally strips
// every raw-HTML mdast node after parsing (fenced code content is never
// interpreted as HTML by remark in the first place, so this never touched
// it either), which is the actual defense — a regex pass over unparsed text
// can't distinguish "HTML in prose" from "HTML as a literal string inside a
// code fence" the way a real parser can.
