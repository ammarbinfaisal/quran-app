/**
 * Precompute Translation Assets
 *
 * Converts public/data/abu-iyaad.json from its scraped HTML format
 * (with <span style="color:#898989;"> annotations) into a compact
 * precomputed segment array format.
 *
 * Input  (abu-iyaad.json):  Record<verseKey, htmlString>
 * Output (abu-iyaad.json):  Record<verseKey, CompactSeg[]>
 *   where CompactSeg = string (text run) | { a: string } (annotation)
 *
 * Run: bun scripts/precompute-translations.ts
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CompactSeg = string | { a: string };

const ABU_IYAAD_PATH = path.join(process.cwd(), "public", "data", "abu-iyaad.json");

// Matches the abu-iyaad annotation span (any attributes, any content).
const SPAN_RE = /<span\b[^>]*>([\s\S]*?)<\/span>/gi;

// Decode numeric and named HTML entities.
const NAMED: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0",
    ldquo: "\u201c", rdquo: "\u201d", lsquo: "\u2018", rsquo: "\u2019",
    ndash: "\u2013", mdash: "\u2014", hellip: "\u2026",
};

function decodeEntities(s: string): string {
    return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);?/g, (m, e) => {
        if (!e) return m;
        if (e[0] === "#") {
            const norm = e.toLowerCase();
            const cp = norm.startsWith("#x")
                ? parseInt(norm.slice(2), 16)
                : parseInt(norm.slice(1), 10);
            return Number.isFinite(cp) ? String.fromCodePoint(cp) : m;
        }
        return NAMED[e] ?? m;
    });
}

function stripTags(s: string): string {
    return s.replace(/<[^>]+>/g, "");
}

/**
 * Parse an HTML string (abu-iyaad verse) into CompactSeg[].
 * <span ...>content</span>  → { a: content }   (annotation)
 * everything else           → decoded plain text (string)
 */
function parseAbuIyaadHtml(html: string): CompactSeg[] {
    const segs: CompactSeg[] = [];
    let lastIndex = 0;
    let m: RegExpExecArray | null;

    SPAN_RE.lastIndex = 0;
    while ((m = SPAN_RE.exec(html)) !== null) {
        // Text before the span
        if (m.index > lastIndex) {
            const text = decodeEntities(stripTags(html.slice(lastIndex, m.index))).trim();
            // Preserve space between segments (don't collapse to nothing)
            const raw = decodeEntities(stripTags(html.slice(lastIndex, m.index)));
            if (raw) segs.push(raw);
        }

        // The span content is the annotation (includes the parentheses in the source)
        const innerRaw = m[1] ?? "";
        const inner = decodeEntities(stripTags(innerRaw)).trim();
        if (inner) segs.push({ a: inner });

        lastIndex = SPAN_RE.lastIndex;
    }

    // Remaining text after the last span
    if (lastIndex < html.length) {
        const raw = decodeEntities(stripTags(html.slice(lastIndex)));
        if (raw) segs.push(raw);
    }

    return segs;
}

async function run() {
    console.log("Reading", ABU_IYAAD_PATH, "...");
    const raw = await readFile(ABU_IYAAD_PATH, "utf-8");
    const input = JSON.parse(raw) as Record<string, unknown>;

    // Detect format: if the first value is a string we need to convert;
    // if it's already an array (pre-processed), bail out.
    const firstValue = Object.values(input)[0];
    if (Array.isArray(firstValue)) {
        console.log("Already in compact segment format — nothing to do.");
        return;
    }
    if (typeof firstValue !== "string") {
        console.error("Unexpected format:", typeof firstValue);
        process.exit(1);
    }

    console.log(`Processing ${Object.keys(input).length} verses...`);
    const output: Record<string, CompactSeg[]> = {};

    for (const [key, value] of Object.entries(input)) {
        output[key] = parseAbuIyaadHtml(value as string);
    }

    await writeFile(ABU_IYAAD_PATH, JSON.stringify(output));
    console.log("Done. Written to", ABU_IYAAD_PATH);

    // Quick sanity check
    let annotationCount = 0;
    for (const segs of Object.values(output)) {
        for (const s of segs) {
            if (typeof s !== "string") annotationCount++;
        }
    }
    console.log(`  ${Object.keys(output).length} verses, ${annotationCount} annotation segments`);
}

run().catch((e) => { console.error(e); process.exit(1); });
