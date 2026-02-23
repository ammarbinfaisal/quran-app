import { writeFile } from "fs/promises";
import * as cheerio from "cheerio";
import { join } from "path";

async function run() {
    const result: Record<string, string> = {};

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
                        let trText = $(el).text() || "";
                        trText = trText.replace(/\s+/g, ' ').trim();
                        if (trText.length > 0) {
                            const verseKey = s + ":" + verseNum;
                            result[verseKey] = trText;
                            foundAny = true;
                        }
                    }
                });

                if (!foundAny) {
                    keepGoing = false;
                } else {
                    start += 10;
                }
            } catch (e) {
                console.error("\nError fetching sura " + s + " start " + start + ":", e);
                keepGoing = false;
            }
        }
        console.log(" Done.");
    }

    const destPath = join(process.cwd(), "public", "data", "abu-iyaad.json");
    await writeFile(destPath, JSON.stringify(result, null, 2));
    console.log("\nSaved " + Object.keys(result).length + " keys to " + destPath);
}

run().catch(console.error);
