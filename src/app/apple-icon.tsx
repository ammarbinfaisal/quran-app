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
          background:
            "radial-gradient(circle at 30% 30%, #fde68a 0%, transparent 55%), linear-gradient(135deg, #f7f1e4 0%, #efe8d6 100%)",
          border: "1px solid rgba(160, 144, 112, 0.25)",
        }}
      >
        <div
          style={{
            width: 148,
            height: 148,
            borderRadius: 36,
            background: "linear-gradient(135deg, #8b6914 0%, #c4a35a 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 18px 44px rgba(139, 105, 20, 0.25)",
          }}
        >
          <div
            style={{
              fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
              fontSize: 112,
              lineHeight: 1,
              fontWeight: 900,
              color: "#1a1410",
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
