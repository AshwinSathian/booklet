"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem",
          background: "#0a0a0a",
          color: "#f5f5f7",
          fontFamily: "system-ui, -apple-system, sans-serif",
          textAlign: "center",
          padding: "0 1.5rem",
        }}
      >
        <div>
          <p style={{ fontFamily: "monospace", fontSize: "0.875rem", color: "#98989f" }}>500</p>
          <h1 style={{ marginTop: "0.5rem", fontSize: "1.5rem", fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#98989f" }}>
            The page failed to load. Try again, or come back later.
          </p>
        </div>
        <button
          onClick={() => reset()}
          style={{
            borderRadius: "9999px",
            background: "#f5a623",
            color: "#0a0a0a",
            fontWeight: 600,
            padding: "0.625rem 1.25rem",
            border: "none",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
