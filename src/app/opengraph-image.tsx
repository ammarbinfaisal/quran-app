import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "quran";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff",
          backgroundImage:
            "radial-gradient(1100px 520px at 25% 20%, rgba(229, 231, 235, 0.8) 0%, transparent 62%), radial-gradient(900px 500px at 80% 70%, rgba(243, 244, 246, 0.9) 0%, transparent 64%)",
          color: "#111827",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div
          style={{
            width: 980,
            display: "flex",
            flexDirection: "column",
            gap: 18,
            padding: 64,
            borderRadius: 48,
            background: "rgba(255, 255, 255, 0.95)",
            border: "1px solid #d1d5db",
            boxShadow: "0 20px 70px rgba(17, 24, 39, 0.12)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: "linear-gradient(135deg, #f9fafb 0%, #e5e7eb 100%)",
                border: "1px solid #d1d5db",
              }}
            />
            <div
              style={{
                fontSize: 24,
                letterSpacing: 2,
                color: "#4b5563",
                textTransform: "uppercase",
              }}
            >
              quran app
            </div>
          </div>

          <div
            style={{
              fontSize: 124,
              lineHeight: 1,
              fontWeight: 800,
              letterSpacing: -2,
              color: "#111827",
            }}
          >
            quran
          </div>
        </div>
      </div>
    ),
    size
  );
}
