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
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 72,
        background: "#0b1020",
        color: "#e9ecf2",
      }}
    >
      <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -1 }}>
        {APP_NAME}
      </div>
      <div
        style={{
          marginTop: 18,
          fontSize: 30,
          lineHeight: 1.3,
          color: "#b4bdd1",
          maxWidth: 900,
        }}
      >
        Paste. Preview. Share.
      </div>
      <div
        style={{
          marginTop: 42,
          display: "inline-flex",
          alignSelf: "flex-start",
          padding: "14px 18px",
          borderRadius: 999,
          background: "rgba(139, 92, 246, 0.18)",
          border: "1px solid rgba(139, 92, 246, 0.35)",
          color: "#e9ecf2",
          fontSize: 18,
        }}
      >
        Calm, readable sharing for technical text
      </div>
    </div>,
    size,
  );
}
