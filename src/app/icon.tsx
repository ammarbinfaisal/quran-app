import { ImageResponse } from "next/og";

export const contentType = "image/png";

export function generateImageMetadata() {
  return [
    { id: "32", size: { width: 32, height: 32 }, contentType },
    { id: "192", size: { width: 192, height: 192 }, contentType },
    { id: "512", size: { width: 512, height: 512 }, contentType },
  ];
}

function IconSvg({ dimension }: { dimension: number }) {
  const base = Math.max(1, Math.round(dimension / 16));
  const letterSize = Math.round(dimension * 0.58);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: Math.round(dimension * 0.24),
        background: "#ffffff",
        border: `${base}px solid #d1d5db`,
      }}
    >
      <div
        style={{
          width: Math.round(dimension * 0.82),
          height: Math.round(dimension * 0.82),
          borderRadius: Math.round(dimension * 0.22),
          background: "linear-gradient(135deg, #ffffff 0%, #f3f4f6 100%)",
          border: `${base}px solid #e5e7eb`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: dimension >= 192 ? "0 10px 28px rgba(17, 24, 39, 0.14)" : "none",
        }}
      >
        <div
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
            fontSize: letterSize,
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
  );
}

export default async function Icon({ id }: { id: string }) {
  const resolvedId = await id;
  const dimension = Number(resolvedId) || 32;

  return new ImageResponse(<IconSvg dimension={dimension} />, {
    width: dimension,
    height: dimension,
  });
}
