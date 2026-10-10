// Spike-only measurement endpoints (S4, S5, S7, S9). Never merged.
// Every probe needs the x-spike-token header: several of them burn CPU on
// purpose and must not be callable by the public on a deployed Worker.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { hashUserPassword, verifyUserPassword } from "@/lib/auth/password";
import { hashPassword, verifyPassword } from "@/lib/password";
import { parseToBlocks } from "@/lib/parse";
import { resolveHostForDelivery } from "@/lib/ssrf-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Made by the native argon2 package (m=65536, t=3, p=4), as production's are.
const NATIVE_ARGON2_HASH = "$argon2id$v=19$m=65536,t=3,p=4$EkxD/AdZ4OWWlYdB+dayvA$qP1gpPlY+6gq1zixVZQgZ02LqxjXQ6oACBBlrDy4rvY";
const PBKDF2_HASH = "600000:074f6451f47759398e7c1720f2c081ed:fd65ad58b63bb468742a81556aa2c261c1c24e8d5e5fc470b91d3d1d8709efee";
const PASSWORD = "spike-password-123";

async function timed<T>(fn: () => Promise<T> | T): Promise<{ ms: number; value: T }> {
  const start = performance.now();
  const value = await fn();
  return { ms: Math.round((performance.now() - start) * 100) / 100, value };
}

async function outcome(url: string): Promise<string> {
  try {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(5000) });
    return `status ${res.status}`;
  } catch (e) {
    return `error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ probe: string }> }) {
  const env = getCloudflareContext().env as unknown as Record<string, string | undefined>;
  if (!env.SPIKE_TOKEN || req.headers.get("x-spike-token") !== env.SPIKE_TOKEN) {
    return new Response("Not found", { status: 404 });
  }
  const { probe } = await params;

  if (probe === "argon2-verify") {
    const r = await timed(() => verifyUserPassword(PASSWORD, NATIVE_ARGON2_HASH));
    const wrong = await verifyUserPassword("not-the-password", NATIVE_ARGON2_HASH);
    return Response.json({ verified: r.value, wrongPasswordRejected: !wrong, ms: r.ms });
  }
  if (probe === "argon2-hash") {
    const r = await timed(() => hashUserPassword(PASSWORD));
    return Response.json({ prefix: r.value.slice(0, 31), ms: r.ms });
  }
  if (probe === "pbkdf2-verify") {
    let r;
    try {
      r = await timed(() => verifyPassword(PASSWORD, PBKDF2_HASH));
    } catch (e) {
      return Response.json({ error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }, { status: 500 });
    }
    return Response.json({ verified: r.value, ms: r.ms });
  }
  if (probe === "pbkdf2-hash") {
    try {
      const r = await timed(() => hashPassword(PASSWORD));
      return Response.json({ iterations: r.value.split(":")[0], ms: r.ms });
    } catch (e) {
      return Response.json({ error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }, { status: 500 });
    }
  }
  if (probe === "pbkdf2-node" || probe === "pbkdf2-noble") {
    // Same derivation as src/lib/password.ts, through two other
    // implementations, because Workers' WebCrypto refuses more than
    // 100,000 PBKDF2 iterations.
    const [iterations, saltHex, wantHex] = PBKDF2_HASH.split(":");
    const salt = Uint8Array.from(saltHex.match(/../g)!, (h) => parseInt(h, 16));
    let got: Uint8Array;
    if (probe === "pbkdf2-node") {
      const { pbkdf2Sync } = await import("node:crypto");
      got = new Uint8Array(pbkdf2Sync(PASSWORD, salt, Number(iterations), 32, "sha256"));
    } else {
      const { pbkdf2 } = await import("@noble/hashes/pbkdf2.js");
      const { sha256 } = await import("@noble/hashes/sha2.js");
      got = pbkdf2(sha256, new TextEncoder().encode(PASSWORD), salt, { c: Number(iterations), dkLen: 32 });
    }
    const gotHex = Array.from(got, (b) => b.toString(16).padStart(2, "0")).join("");
    return Response.json({ iterations: Number(iterations), verified: gotHex === wantHex });
  }
  if (probe === "parse") {
    const raw = await req.text();
    const r = await timed(() => parseToBlocks(raw));
    return Response.json({ chars: raw.length, blocks: r.value.length, ms: r.ms });
  }
  if (probe === "ssrf") {
    const targets = ["http://127.0.0.1/", "http://localhost/", "http://10.0.0.1/", "http://192.168.1.1/", "http://169.254.169.254/latest/meta-data/", "http://[::1]/", "http://100.64.0.1/"];
    const fetches: Record<string, string> = {};
    for (const t of targets) fetches[t] = await outcome(t);
    const dns = await resolveHostForDelivery("example.com").catch((e) => ({ error: String(e) }));
    const dnsLocal = await resolveHostForDelivery("localtest.me").catch((e) => ({ error: String(e) }));
    return Response.json({ fetches, dns, dnsLocal });
  }
  if (probe === "mongo") {
    // S9: the unmodified Node driver from inside a Worker.
    const uri = env.MONGO_SPIKE_URI;
    if (!uri) return Response.json({ error: "MONGO_SPIKE_URI not set" }, { status: 400 });
    try {
      const { MongoClient } = await import("mongodb");
      const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
      const connect = await timed(() => client.connect());
      const coll = client.db("booklet_spike").collection<{ _id: string; at: string }>("probe");
      const write = await timed(() => coll.updateOne({ _id: "probe" }, { $set: { at: new Date().toISOString() } }, { upsert: true }));
      const read = await timed(() => coll.findOne({ _id: "probe" }));
      await client.close();
      return Response.json({ connectMs: connect.ms, writeMs: write.ms, readMs: read.ms, readBack: Boolean(read.value) });
    } catch (e) {
      return Response.json({ error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }, { status: 500 });
    }
  }
  return new Response("Not found", { status: 404 });
}
