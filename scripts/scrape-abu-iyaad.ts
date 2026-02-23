import { writeFile } from "fs/promises";
import * as cheerio from "cheerio";
import { join } from "path";

type CompactSeg = string | { a: string };

// Named HTML entities commonly found in the scraped content.
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

const SPAN_RE = /<span\b[^>]*>([\s\S]*?)<\/span>/gi;

/**
 * Convert the inner HTML of a verse element into a CompactSeg[].
 * <span ...>content</span>  → { a: content }   (annotation run)
 * everything else           → decoded plain-text string
 */
function parseVerseHtml(html: string): CompactSeg[] {
    const segs: CompactSeg[] = [];
    let lastIndex = 0;
    let m: RegExpExecArray | null;

    SPAN_RE.lastIndex = 0;
    while ((m = SPAN_RE.exec(html)) !== null) {
        if (m.index > lastIndex) {
            const raw = decodeEntities(stripTags(html.slice(lastIndex, m.index)));
            if (raw) segs.push(raw);
        }

        const inner = decodeEntities(stripTags(m[1] ?? "")).trim();
        if (inner) segs.push({ a: inner });

        lastIndex = SPAN_RE.lastIndex;
    }

    if (lastIndex < html.length) {
        const raw = decodeEntities(stripTags(html.slice(lastIndex)));
        if (raw) segs.push(raw);
    }

    return segs;
}

// Verse counts per surah (1-indexed). Total = 6236.
const SURAH_VERSE_COUNTS = [
    0, // index 0 unused
    7, 286, 200, 176, 120, 165, 206, 75, 129, 109,  // 1-10
    123, 111, 43, 52, 99, 128, 111, 110, 98, 135,    // 11-20
    112, 78, 118, 64, 77, 227, 93, 88, 69, 60,       // 21-30
    34, 30, 73, 54, 45, 83, 182, 88, 75, 85,         // 31-40
    54, 53, 89, 59, 37, 35, 38, 29, 18, 45,          // 41-50
    60, 49, 62, 55, 78, 96, 29, 22, 24, 13,          // 51-60
    14, 11, 11, 18, 12, 12, 30, 52, 52, 44,          // 61-70
    28, 28, 20, 56, 40, 31, 50, 40, 46, 42,          // 71-80
    29, 19, 36, 25, 22, 17, 19, 26, 30, 20,          // 81-90
    15, 21, 11, 8, 8, 19, 5, 8, 8, 11,               // 91-100
    11, 8, 3, 9, 5, 4, 7, 3, 6, 3,                   // 101-110
    5, 4, 5, 6,                                        // 111-114
];

// QURAN_CUMULATIVE[s] = total verses in surahs 1..s (i.e. verses before surah s+1)
const QURAN_CUMULATIVE: number[] = [0];
for (let s = 1; s <= 114; s++) {
    QURAN_CUMULATIVE[s] = QURAN_CUMULATIVE[s - 1] + SURAH_VERSE_COUNTS[s];
}
// Sanity: QURAN_CUMULATIVE[114] === 6236

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Establish a ColdFusion session by hitting the main page and return the
 * cookie string to pass in subsequent requests.
 */
async function initSession(): Promise<string> {
    const res = await fetch("https://www.thenoblequran.com/q/", {
        headers: { "User-Agent": UA },
    });
    const setCookies: string[] = (res.headers as any).getSetCookie?.() ?? [];
    return setCookies.map((c: string) => c.split(";")[0]).join("; ");
}

async function run() {
    const result: Record<string, CompactSeg[]> = {};

    console.log("Establishing session...");
    const cookieHeader = await initSession();
    console.log("Session ready. Starting scrape...");

    for (let s = 1; s <= 114; s++) {
        process.stdout.write("Fetching sura " + s + "...");
        let start = 1;
        let keepGoing = true;

        while (keepGoing) {
            try {
                const url = "https://www.thenoblequran.com/q/includes/cfm/displaysura.cfm?sura=" + s + "&start=" + start;
                const res = await fetch(url, {
                    headers: {
                        "User-Agent": UA,
                        "Accept": "text/html, */*; q=0.01",
                        "Cookie": cookieHeader,
                        "Referer": "https://www.thenoblequran.com/q/",
                    },
                });

                if (!res.ok) {
                    console.error("\nFailed to fetch " + url + ": " + res.status);
                    keepGoing = false;
                    break;
                }

                const text = await res.text();

                if (text.trim().length === 0 || text.includes('No verses found')) {
                    keepGoing = false;
                }

                const $ = cheerio.load(text);

                let foundAny = false;

                // The rafiam IDs are Quran-wide verse positions (not surah-local).
                // Convert: ayah = rafiamId - QURAN_CUMULATIVE[s - 1]
                const prevCum = QURAN_CUMULATIVE[s - 1];

                $("[id^='rafiam']").each((_, el) => {
                    const id = $(el).attr("id");
                    if (!id) return;
                    const match = id.match(/^rafiam(\d+)$/);
                    if (match) {
                        const quranPos = parseInt(match[1], 10);
                        const ayah = quranPos - prevCum;
                        if (ayah < 1 || ayah > SURAH_VERSE_COUNTS[s]) return;
                        // Use inner HTML so we preserve annotation <span> tags
                        const innerHtml = $(el).html() ?? "";
                        const segs = parseVerseHtml(innerHtml.replace(/\s+/g, ' '));
                        if (segs.length > 0) {
                            const verseKey = s + ":" + ayah;
                            result[verseKey] = segs;
                            foundAny = true;
                        }
                    }
                });

                if (!foundAny) {
                    keepGoing = false;
                } else {
                    start += 10;
                    await new Promise(r => setTimeout(r, 200));
                }
            } catch (e) {
                console.error("\nError fetching sura " + s + " start " + start + ":", e);
                keepGoing = false;
            }
        }
        console.log(" Done.");
    }

    const destPath = join(process.cwd(), "public", "data", "abu-iyaad.json");
    await writeFile(destPath, JSON.stringify(result));
    console.log("\nSaved " + Object.keys(result).length + " keys to " + destPath);
}

run().catch(console.error);
