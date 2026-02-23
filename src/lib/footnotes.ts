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
  | { type: "footnote"; id: string; label: string }
  | { type: "annotation"; text: string };

/** Precomputed translation ready for rendering and copy. */
export interface TranslationContent {
  segments: TranslationSegment[];
  /** Plain text suitable for clipboard copy (text + annotations, no footnote refs). */
  plain: string;
}

/** Compact segment as stored in precomputed JSON files.
 * A bare string is a text run; {a: "..."} is an annotation. */
export type CompactSeg = string | { a: string };

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
 * Parses plain text (no HTML) into segments, recognising annotation brackets.
 * For saheeh: [brackets] are annotations.
 * For hilali-khan: both (parens) and [brackets] are annotations.
 * Nested mixed brackets are treated as a single outer annotation.
 */
export function parseBracketAnnotations(
  text: string,
  config: { parens: boolean; brackets: boolean },
): TranslationSegment[] {
  if (!config.parens && !config.brackets) {
    return text ? [{ type: "text", text }] : [];
  }

  const segments: TranslationSegment[] = [];
  let textStart = 0;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    const isOpen = (ch === "(" && config.parens) || (ch === "[" && config.brackets);

    if (isOpen) {
      if (i > textStart) {
        const t = text.slice(textStart, i);
        if (t) segments.push({ type: "text", text: t });
      }

      const closeChar = ch === "(" ? ")" : "]";
      let depth = 1;
      let j = i + 1;

      while (j < text.length && depth > 0) {
        const inner = text[j];
        if (inner === ch) depth++;
        else if (inner === closeChar) {
          depth--;
          if (depth === 0) break;
        }
        j++;
      }

      if (depth === 0) {
        // j is at the closing char
        const annotationText = text.slice(i, j + 1);
        segments.push({ type: "annotation", text: annotationText });
        i = j + 1;
        textStart = i;
      } else {
        // Unmatched bracket — treat as regular text
        i++;
      }
    } else {
      i++;
    }
  }

  if (textStart < text.length) {
    const t = text.slice(textStart);
    if (t) segments.push({ type: "text", text: t });
  }

  return segments;
}

function bracketConfigFor(translationId?: TranslationId): { parens: boolean; brackets: boolean } {
  switch (translationId) {
    case "saheeh":
      return { parens: false, brackets: true };
    case "hilali-khan":
      return { parens: true, brackets: true };
    default:
      return { parens: false, brackets: false };
  }
}

/**
 * Parses HTML into segments of text, footnote references, and bracket annotations.
 * Pass translationId to enable bracket annotation detection for saheeh / hilali-khan.
 */
export function parseTranslationSegments(
  html: string,
  translationId?: TranslationId,
): TranslationSegment[] {
  const segments: TranslationSegment[] = [];
  const bracketConfig = bracketConfigFor(translationId);
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  FOOTNOTE_EXTRACT_REGEX.lastIndex = 0;
  while ((match = FOOTNOTE_EXTRACT_REGEX.exec(html)) !== null) {
    // Add text (with possible bracket annotations) before the match
    if (match.index > lastIndex) {
      const plain = decodeHtmlEntities(stripHtmlTags(html.slice(lastIndex, match.index)));
      if (plain) segments.push(...parseBracketAnnotations(plain, bracketConfig));
    }

    const id = match[1] ?? match[2] ?? match[3];
    const rawLabel = match[4] ?? "";
    const label = decodeHtmlEntities(stripHtmlTags(rawLabel)).trim();

    if (id) {
      segments.push({ type: "footnote", id, label: label || "1" });
    }

    lastIndex = FOOTNOTE_EXTRACT_REGEX.lastIndex;
  }

  // Remaining text
  if (lastIndex < html.length) {
    const plain = decodeHtmlEntities(stripHtmlTags(html.slice(lastIndex)));
    if (plain) segments.push(...parseBracketAnnotations(plain, bracketConfig));
  }

  return segments;
}

/** Build a TranslationContent from an array of TranslationSegments. */
export function segmentsToContent(segments: TranslationSegment[]): TranslationContent {
  const plain = segments
    .filter((s) => s.type !== "footnote")
    .map((s) => s.text)
    .join("");
  return { segments, plain };
}

/** Convert precomputed CompactSeg[] (from JSON) to TranslationContent. */
export function compactToContent(compact: CompactSeg[]): TranslationContent {
  const segments: TranslationSegment[] = compact.map((s) =>
    typeof s === "string"
      ? { type: "text" as const, text: s }
      : { type: "annotation" as const, text: s.a },
  );
  return segmentsToContent(segments);
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
