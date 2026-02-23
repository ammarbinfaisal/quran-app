import { writeFileSync, existsSync, readFileSync } from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

const DATA_FILE = path.join(process.cwd(), 'public/data/syntax.json');
const DELAY_MIN = 250;
const DELAY_MAX = 550;

// Total ayahs per surah (standard Madani count)
const SURAH_INFO = [
    7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6
];

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeVerse(chapter: number, verse: number) {
    const url = `https://corpus.quran.com/treebank.jsp?chapter=${chapter}&verse=${verse}`;
    console.log(`Fetching ${chapter}:${verse}...`);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Failed to fetch ${chapter}:${verse}: ${response.statusText}`);
            return null;
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Extract graph image URL
        // The graph is usually in a div with id="graphimage" or similar, or as a background image
        // Based on inspection, it's a div class="graph" with a style background-image
        const graphDiv = $('.graph');
        const style = graphDiv.attr('style') || '';
        const match = style.match(/url\((.*?)\)/);
        let graphUrl = match ? match[1].replace(/['"]/g, '') : '';

        if (graphUrl && !graphUrl.startsWith('http')) {
            graphUrl = `https://corpus.quran.com${graphUrl}`;
        }

        // Also extract grammar text if available
        const grammarSection = $('.grammar'); // Fallback check
        const grammarText = grammarSection.text().trim();

        return {
            graphUrl,
            grammarText,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error(`Error fetching ${chapter}:${verse}:`, error);
        return null;
    }
}

async function main() {
    let data: Record<string, unknown> = {};
    if (existsSync(DATA_FILE)) {
        data = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
    }

    for (let s = 1; s <= 114; s++) {
        const ayahs = SURAH_INFO[s - 1];
        for (let a = 1; a <= ayahs; a++) {
            const key = `${s}:${a}`;
            if (data[key]) {
                // Skip if already scraped
                continue;
            }

            const result = await scrapeVerse(s, a);
            if (result) {
                data[key] = result;
                // Save incrementally
                writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
            }

            const delay = Math.floor(Math.random() * (DELAY_MAX - DELAY_MIN + 1)) + DELAY_MIN;
            await sleep(delay);
        }
    }

    console.log('Scraping complete!');
}

main().catch(console.error);
