import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 40,
          background: "#ffffff",
          border: "1px solid #d1d5db",
        }}
      >
        <div
          style={{
            width: 148,
            height: 148,
            borderRadius: 36,
            background: "linear-gradient(135deg, #ffffff 0%, #f3f4f6 100%)",
            border: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 10px 28px rgba(17, 24, 39, 0.14)",
          }}
        >
          <div
            style={{
              fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
              fontSize: 112,
              lineHeight: 1,
              fontWeight: 800,
              color: "#111827",
              transform: "translateY(-2%)",
            }}
          >
            q
          </div>
        </div>
      </div>
    ),
    size
  );
}
