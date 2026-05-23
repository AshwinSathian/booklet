export function sseEvent(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}

export function ssePing(): string {
  return `: ping\n\n`;
}

// Enqueues a keepalive comment every 25 seconds to prevent Cloudflare from closing the stream.
// Returns a cancel function to clear the interval on disconnect.
export function startKeepalive(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
): () => void {
  const interval = setInterval(() => {
    try {
      controller.enqueue(encoder.encode(ssePing()));
    } catch {
      clearInterval(interval);
    }
  }, 25_000);
  return () => clearInterval(interval);
}
