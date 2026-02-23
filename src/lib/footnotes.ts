import type { TranslationId } from "./types";

export type FootnoteMap = Partial<Record<TranslationId, Record<string, string>>>;

export interface FootnoteReference {
  id: string;
  label: string;
}

const FOOTNOTE_ASSET_URL = "/mushaf-data/translation-footnotes.json";
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export type TranslationSegment =
  | { type: "text"; text: string }
  | { type: "footnote"; id: string; label: string };

let cachedFootnotes: FootnoteMap | null = null;
let footnotePromise: Promise<FootnoteMap> | null = null;

export async function loadTranslationFootnotes(): Promise<FootnoteMap> {
  if (cachedFootnotes) return cachedFootnotes;
  if (!footnotePromise) {
    footnotePromise = fetch(FOOTNOTE_ASSET_URL)
      .then((res) => {
        if (!res.ok) return {} as FootnoteMap;
        return res.json() as Promise<FootnoteMap>;
      })
      .catch(() => ({} as FootnoteMap));
  }
  cachedFootnotes = await footnotePromise;
  return cachedFootnotes;
}

const FOOTNOTE_STRIP_REGEX =
  /<sup\b[^>]*\bfoot_note\s*=\s*(?:"[^"]+"|'[^']+'|[^\s>]+)[^>]*>[\s\S]*?<\/sup>/gi;

const FOOTNOTE_EXTRACT_REGEX =
  /<sup\b[^>]*\bfoot_note\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/sup>/gi;

/**
 * Strip `<sup foot_note=...>...</sup>` tags and other HTML from translation
 * text so it can be displayed as clean plain text.
 */
export function stripFootnoteTags(html: string): string {
  const withoutFootnotes = html.replace(FOOTNOTE_STRIP_REGEX, "");
  return decodeHtmlEntities(stripHtmlTags(withoutFootnotes)).trim();
}

export function extractFootnoteReferences(value: string): FootnoteReference[] {
  const refs: FootnoteReference[] = [];
  let match: RegExpExecArray | null;
  FOOTNOTE_EXTRACT_REGEX.lastIndex = 0;
  while ((match = FOOTNOTE_EXTRACT_REGEX.exec(value)) !== null) {
    const id = match[1] ?? match[2] ?? match[3];
    const rawLabel = match[4] ?? "";
    const label = decodeHtmlEntities(stripHtmlTags(rawLabel)).trim();
    if (!id) continue;
    refs.push({ id, label: label || "1" });
  }
  return refs;
}

/**
 * Parses html into segments of text and footnote references.
 */
export function parseTranslationSegments(html: string): TranslationSegment[] {
  const segments: TranslationSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  FOOTNOTE_EXTRACT_REGEX.lastIndex = 0;
  while ((match = FOOTNOTE_EXTRACT_REGEX.exec(html)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        text: decodeHtmlEntities(stripHtmlTags(html.slice(lastIndex, match.index))),
      });
    }

    const id = match[1] ?? match[2] ?? match[3];
    const rawLabel = match[4] ?? "";
    const label = decodeHtmlEntities(stripHtmlTags(rawLabel)).trim();

    if (id) {
      segments.push({ type: "footnote", id, label: label || "1" });
    }

    lastIndex = FOOTNOTE_EXTRACT_REGEX.lastIndex;
  }

  // Add remaining text
  if (lastIndex < html.length) {
    segments.push({
      type: "text",
      text: decodeHtmlEntities(stripHtmlTags(html.slice(lastIndex))),
    });
  }

  return segments;
}

function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]+>/g, "");
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);?/g, (match, entity) => {
    if (!entity) return match;
    if (entity[0] === "#") {
      const normalized = entity.toLowerCase();
      const codePoint =
        normalized.startsWith("#x")
          ? Number.parseInt(normalized.slice(2), 16)
          : Number.parseInt(normalized.slice(1), 10);
      if (Number.isFinite(codePoint)) {
        return String.fromCodePoint(codePoint);
      }
      return match;
    }
    return NAMED_ENTITIES[entity] ?? match;
  });
}
