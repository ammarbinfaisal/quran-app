import fs from "fs/promises";
import path from "path";
import { getPagePayloadUrls, getPageFontUrl, getPageFontFamily } from "@/mushaf-engine/assets";
import { decodeMushafPagePayloadFromProto } from "@/lib/mushaf/proto";
import type { MushafCode } from "@/lib/preferences";
import type { MushafPagePayload } from "@/lib/mushaf/proto";

/**
 * Reads the Mushaf page payload (protobuf) directly from the file system.
 * This is intended for Server Components (SSG/ISR) to inline the critical data.
 */
export async function getMushafPagePayload(
  mushafCode: MushafCode,
  page: number
): Promise<MushafPagePayload | null> {
  try {
    const { protoUrl } = getPagePayloadUrls(mushafCode, page);
    // protoUrl is like "/mushaf-data/v1/p001.pb"
    // We must ensure path.join doesn't treat the leading slash as an absolute root
    const relativePath = protoUrl.startsWith("/") ? protoUrl.slice(1) : protoUrl;
    const filePath = path.join(process.cwd(), "public", relativePath);

    const buffer = await fs.readFile(filePath);
    return decodeMushafPagePayloadFromProto(buffer);
  } catch (err) {
    console.error(`Failed to read mushaf payload for ${mushafCode}:${page}`, err);
    return null;
  }
}

/**
 * Generates the <style> tag content for critical font loading.
 * This ensures the font starts downloading immediately and avoids FOIT/FOUT.
 */
export function getCriticalFontStyles(mushafCode: MushafCode, page: number): string {
  const fontUrl = getPageFontUrl(mushafCode, page);
  const fontFamily = getPageFontFamily(mushafCode, page);

  if (!fontUrl) return "";

  // We use font-display: block to prevent layout shifts (invisible text until font loads)
  // or swap if we prefer a fallback immediately. Given the user's focus on "no loading state",
  // 'block' or 'optional' might be better, but 'block' ensures the correct glyphs render.
  // Actually, for Quran, fallback fonts are usually wrong/broken. 'block' is safer.
  return `
    @font-face {
      font-family: '${fontFamily}';
      src: url('${fontUrl}') format('woff2');
      font-display: block;
    }
  `;
}
