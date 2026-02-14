import fs from "fs/promises";
import { getPagePayloadUrls, getPageFontUrl, getPageFontFamily } from "@/mushaf-engine/assets";
import { decodeMushafPagePayloadFromProto } from "@/lib/mushaf/proto";
import type { MushafCode } from "@/lib/preferences";
import type { MushafPagePayload } from "@/lib/mushaf/proto";

// Construct the base path once. Using string concatenation (not path.join with
// process.cwd()) prevents Turbopack from statically tracing the public/ tree,
// which otherwise indexes all ~10K generated assets and can OOM/crash.
const PUBLIC_DIR = process.cwd() + "/public";

/**
 * Reads the Mushaf page payload (protobuf) directly from the file system.
 * This is intended for Server Components (SSG/ISR) to inline the critical data.
 */
export async function getMushafPagePayload(
  mushafCode: MushafCode,
  page: number
): Promise<MushafPagePayload | null> {
  try {
    const padded = String(page).padStart(3, "0");
    const filePath = `${PUBLIC_DIR}/mushaf-data/${mushafCode}/p${padded}.pb`;

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

  return `
    @font-face {
      font-family: '${fontFamily}';
      src: url('${fontUrl}') format('woff2');
      font-display: block;
    }
  `;
}
