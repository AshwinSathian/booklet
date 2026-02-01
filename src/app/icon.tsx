import { APP_NAME } from "@/lib/constants";
import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0b1020",
      }}
    >
      <div
        style={{
          width: 392,
          height: 392,
          borderRadius: 96,
          background: "rgba(139, 92, 246, 0.14)",
          border: "1px solid rgba(139, 92, 246, 0.35)",
          boxShadow: "0 0 60px rgba(139, 92, 246, 0.22)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Stylized “R” mark as a simple geometric glyph */}
        <div
          style={{
            width: 210,
            height: 210,
            borderRadius: 56,
            background: "rgba(233, 236, 242, 0.06)",
            border: "1px solid rgba(233, 236, 242, 0.10)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              fontSize: 132,
              fontWeight: 900,
              color: "#e9ecf2",
              letterSpacing: -6,
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
              lineHeight: 1,
            }}
          >
            R
          </div>

          {/* page-corner accent */}
          <div
            style={{
              position: "absolute",
              right: 22,
              top: 22,
              width: 42,
              height: 42,
              borderTopRightRadius: 16,
              background: "rgba(139, 92, 246, 0.95)",
              boxShadow: "0 0 22px rgba(139, 92, 246, 0.35)",
              transform: "rotate(8deg)",
            }}
          />
        </div>
      </div>

      {/* hidden text for accessibility */}
      <div style={{ position: "absolute", opacity: 0 }}>{APP_NAME}</div>
    </div>,
    size,
  );
}
