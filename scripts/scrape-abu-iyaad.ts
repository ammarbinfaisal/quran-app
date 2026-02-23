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

async function run() {
    const result: Record<string, CompactSeg[]> = {};

    console.log("Starting scrape...");

    for (let s = 1; s <= 114; s++) {
        process.stdout.write("Fetching sura " + s + "...");
        let start = 1;
        let keepGoing = true;

        while (keepGoing) {
            try {
                const url = "https://www.thenoblequran.com/q/includes/cfm/displaysura.cfm?sura=" + s + "&start=" + start;
                const res = await fetch(url, {
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        Accept: "text/html, */*; q=0.01",
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

                $("[id^='rafiam']").each((_, el) => {
                    const id = $(el).attr("id");
                    if (!id) return;
                    const match = id.match(/^rafiam(\d+)$/);
                    if (match) {
                        const verseNum = match[1];
                        // Use inner HTML so we preserve annotation <span> tags
                        const innerHtml = $(el).html() ?? "";
                        const segs = parseVerseHtml(innerHtml.replace(/\s+/g, ' '));
                        if (segs.length > 0) {
                            const verseKey = s + ":" + verseNum;
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
