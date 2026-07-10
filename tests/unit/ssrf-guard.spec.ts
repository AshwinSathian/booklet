import { test, expect } from "@playwright/test";
import { isBlockedIp, isUrlSafe, resolveHostSafely } from "@/lib/ssrf-guard";

test.describe("isBlockedIp", () => {
  test("blocks IPv4 loopback", () => {
    expect(isBlockedIp("127.0.0.1")).toBe(true);
    expect(isBlockedIp("127.0.0.53")).toBe(true);
  });

  test("blocks the cloud metadata / link-local range", () => {
    expect(isBlockedIp("169.254.169.254")).toBe(true);
  });

  test("blocks RFC1918 private ranges", () => {
    expect(isBlockedIp("10.1.2.3")).toBe(true);
    expect(isBlockedIp("172.16.5.4")).toBe(true);
    expect(isBlockedIp("172.31.255.255")).toBe(true);
    expect(isBlockedIp("192.168.1.1")).toBe(true);
  });

  test("does not block a public IPv4 address", () => {
    expect(isBlockedIp("93.184.216.34")).toBe(false); // example.com-ish public IP
    expect(isBlockedIp("8.8.8.8")).toBe(false);
  });

  test("does not block an address just outside a private range", () => {
    expect(isBlockedIp("172.15.255.255")).toBe(false);
    expect(isBlockedIp("172.32.0.0")).toBe(false);
  });

  test("blocks IPv6 loopback and link-local/ULA", () => {
    expect(isBlockedIp("::1")).toBe(true);
    expect(isBlockedIp("fe80::1")).toBe(true);
    expect(isBlockedIp("fd12:3456:789a::1")).toBe(true);
  });

  test("blocks IPv4-mapped IPv6 loopback (::ffff:127.0.0.1)", () => {
    expect(isBlockedIp("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedIp("::ffff:7f00:1")).toBe(true); // same address, hex form
  });

  test("blocks IPv4-mapped IPv6 metadata address", () => {
    expect(isBlockedIp("::ffff:169.254.169.254")).toBe(true);
  });

  test("does not block a public IPv6 address", () => {
    expect(isBlockedIp("2001:4860:4860::8888")).toBe(false); // Google public DNS
  });
});

test.describe("resolveHostSafely", () => {
  test("rejects literal localhost without resolving", async () => {
    const result = await resolveHostSafely("localhost");
    expect(result.safe).toBe(false);
  });

  test("rejects an IP literal in a blocked range", async () => {
    const result = await resolveHostSafely("127.0.0.1");
    expect(result.safe).toBe(false);
  });

  test("rejects an IPv6 literal in a blocked range", async () => {
    const result = await resolveHostSafely("::1");
    expect(result.safe).toBe(false);
  });

  test("accepts a public IP literal", async () => {
    const result = await resolveHostSafely("8.8.8.8");
    expect(result.safe).toBe(true);
  });
});

test.describe("isUrlSafe", () => {
  test("rejects http://127.0.0.1 with a port", async () => {
    const result = await isUrlSafe("http://127.0.0.1:8080/hook");
    expect(result.safe).toBe(false);
  });

  test("rejects the cloud metadata endpoint", async () => {
    const result = await isUrlSafe("http://169.254.169.254/latest/meta-data/");
    expect(result.safe).toBe(false);
  });

  test("rejects literal localhost", async () => {
    const result = await isUrlSafe("http://localhost/webhook");
    expect(result.safe).toBe(false);
  });

  test("rejects non-http(s) schemes", async () => {
    const result = await isUrlSafe("file:///etc/passwd");
    expect(result.safe).toBe(false);
    const result2 = await isUrlSafe("ftp://example.com/hook");
    expect(result2.safe).toBe(false);
  });

  test("rejects malformed URLs", async () => {
    const result = await isUrlSafe("not a url");
    expect(result.safe).toBe(false);
  });

  test("accepts a normal public HTTPS URL", async () => {
    const result = await isUrlSafe("https://example.com/webhook");
    expect(result.safe).toBe(true);
  });
});
