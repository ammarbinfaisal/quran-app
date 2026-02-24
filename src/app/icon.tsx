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
  const letterSize = Math.round(dimension * 0.62);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: Math.round(dimension * 0.24),
        background:
          "radial-gradient(circle at 30% 30%, #fde68a 0%, transparent 55%), linear-gradient(135deg, #f7f1e4 0%, #efe8d6 100%)",
        border: `${base}px solid rgba(160, 144, 112, 0.25)`,
      }}
    >
      <div
        style={{
          width: Math.round(dimension * 0.82),
          height: Math.round(dimension * 0.82),
          borderRadius: Math.round(dimension * 0.22),
          background: "linear-gradient(135deg, #8b6914 0%, #c4a35a 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow:
            dimension >= 192 ? "0 18px 44px rgba(139, 105, 20, 0.25)" : "none",
        }}
      >
        <div
          style={{
            fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
            fontSize: letterSize,
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
