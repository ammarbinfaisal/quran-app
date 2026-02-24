import { ImageResponse } from "next/og";

export const runtime = "edge";
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
          background:
            "radial-gradient(900px 500px at 30% 30%, #fde68a 0%, transparent 60%), radial-gradient(900px 500px at 70% 60%, #f7f1e4 0%, transparent 60%), linear-gradient(135deg, #f7f1e4 0%, #f3e4c7 55%, #efe8d6 100%)",
          color: "#2c2c2c",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
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
            background: "rgba(255, 255, 255, 0.35)",
            border: "1px solid rgba(160, 144, 112, 0.25)",
            boxShadow: "0 24px 80px rgba(0, 0, 0, 0.12)",
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
                background: "linear-gradient(135deg, #8b6914 0%, #c4a35a 100%)",
                boxShadow: "0 10px 24px rgba(139, 105, 20, 0.25)",
              }}
            />
            <div
              style={{
                fontSize: 24,
                letterSpacing: 2,
                color: "rgba(44, 44, 44, 0.7)",
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

