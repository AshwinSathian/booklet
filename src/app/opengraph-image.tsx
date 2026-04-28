import { APP_NAME } from "@/lib/constants";
import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#000000",
          padding: "72px 80px",
          position: "relative",
          overflow: "hidden",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        {/* Ambient glow — top centre */}
        <div
          style={{
            position: "absolute",
            top: -160,
            left: "50%",
            transform: "translateX(-50%)",
            width: 700,
            height: 700,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(124,92,252,0.18) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Ambient glow — bottom right */}
        <div
          style={{
            position: "absolute",
            bottom: -80,
            right: -80,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(167,139,250,0.10) 0%, transparent 65%)",
            pointerEvents: "none",
          }}
        />

        {/* Top row — logo mark + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* R mark */}
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 13,
              background: "#7c5cfc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M 6.5 5 L 6.5 19 M 6.5 5 L 13 5 Q 17 5 17 9 Q 17 13 13 13 L 6.5 13 M 11.5 13 L 17 19"
                stroke="white"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: "#f5f5f7",
              letterSpacing: "-0.5px",
            }}
          >
            {APP_NAME}
          </span>
        </div>

        {/* Centre — headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: "-2.5px",
              color: "#f5f5f7",
              maxWidth: 900,
            }}
          >
            Write in Markdown.
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: "-2.5px",
              background: "linear-gradient(90deg, #7c5cfc 0%, #a78bfa 60%, #7c5cfc 100%)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
              maxWidth: 900,
            }}
          >
            Get a page worth sharing.
          </div>
        </div>

        {/* Bottom row — tagline + pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontSize: 22,
              color: "#98989f",
              lineHeight: 1.5,
              maxWidth: 640,
            }}
          >
            Beautiful, shareable pages from any Markdown —{" "}
            <span style={{ color: "#f5f5f7" }}>
              incident reports, ADRs, READMEs, docs.
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 24px",
              borderRadius: 9999,
              background: "rgba(124, 92, 252, 0.15)",
              border: "1px solid rgba(124, 92, 252, 0.35)",
              color: "#a78bfa",
              fontSize: 18,
              fontWeight: 600,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Free · No account
          </div>
        </div>
      </div>
    ),
    size,
  );
}
