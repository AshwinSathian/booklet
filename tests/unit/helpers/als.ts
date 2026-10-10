// Side-effect module, imported first by request-scope.ts. Outside the Next
// runtime, Next falls back to a stub AsyncLocalStorage that throws on first
// use unless the real one is already on globalThis when "next/server" loads.
// It lives in its own file because imports are hoisted above statements.
import { AsyncLocalStorage } from "node:async_hooks";

(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage ??= AsyncLocalStorage;
