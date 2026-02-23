import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

const INPUT_FILE = path.join(process.cwd(), 'quranic-corpus-morphology-0.4.txt');
const OUTPUT_FILE = path.join(process.cwd(), 'public/data/morphology.json');
const LEMMAS_DIR = path.join(process.cwd(), 'public/data/lemmas');

function parseLine(line: string) {
    if (line.startsWith('#') || !line.trim()) return null;

    // Format: (1:1:1:1)	bisomi	P	STEM|POS:P|LEM:bi|PREFIX|bi+
    const match = line.match(/\((\d+):(\d+):(\d+):(\d+)\)\s+(\S+)\s+(\S+)\s+(.+)/);
    if (!match) return null;

    const [, surah, ayah, word, segment, form, pos, features] = match;

    return {
        surah: parseInt(surah),
        ayah: parseInt(ayah),
        word: parseInt(word),
        segment: parseInt(segment),
        form,
        pos,
        features: features.split('|').reduce((acc: Record<string, unknown>, f) => {
            if (f.includes(':')) {
                const [k, v] = f.split(':');
                acc[k.toLowerCase()] = v;
            } else {
                acc.flags = acc.flags || [];
                (acc.flags as string[]).push(f);
            }
            return acc;
        }, {})
    };
}

function processLexeme(lexeme: string): string {
    // Remove unwanted prefixes and tags that corpus adds, e.g. {
    // Some lemmas start with {, e.g. LEM:{som
    return lexeme.replace(/[{}]/g, '');
}

function main() {
    if (!existsSync(INPUT_FILE)) {
        console.error(`Input file not found: ${INPUT_FILE}`);
        return;
    }

    if (!existsSync(LEMMAS_DIR)) {
        mkdirSync(LEMMAS_DIR, { recursive: true });
    }

    const content = readFileSync(INPUT_FILE, 'utf-8');
    const lines = content.split('\n');

    const morphology: Record<string, unknown[]> = {};
    const lemmas: Record<string, { surah: number, ayah: number, word: number }[]> = {};

    for (const line of lines) {
        const data = parseLine(line);
        if (!data) continue;

        const key = `${data.surah}:${data.ayah}:${data.word}`;
        if (!morphology[key]) {
            morphology[key] = [];
        }

        morphology[key].push({
            segment: data.segment,
            form: data.form,
            pos: data.pos,
            features: data.features
        });

        // Add to lemma index
        const features = data.features as Record<string, unknown>;
        if (typeof features.lem === 'string') {
            const rawLem = features.lem;
            const lem = processLexeme(rawLem);

            if (lem) {
                if (!lemmas[lem]) {
                    lemmas[lem] = [];
                }

                // Keep occurrences unique per word to avoid duplicate entries for multi-segment words with same lemma
                const lastEntry = lemmas[lem].length > 0 ? lemmas[lem][lemmas[lem].length - 1] : null;
                const isDuplicate = lastEntry && lastEntry.surah === data.surah && lastEntry.ayah === data.ayah && lastEntry.word === data.word;

                if (!isDuplicate) {
                    lemmas[lem].push({
                        surah: data.surah,
                        ayah: data.ayah,
                        word: data.word,
                    });
                }
            }
        }
    }

    writeFileSync(OUTPUT_FILE, JSON.stringify(morphology, null, 2));
    console.log(`Successfully processed morphology into ${OUTPUT_FILE}`);

    // Write lemmas
    let lemmaCount = 0;
    for (const [lem, occurrences] of Object.entries(lemmas)) {
        const lemmaFile = path.join(LEMMAS_DIR, `${lem}.json`);
        writeFileSync(lemmaFile, JSON.stringify(occurrences, null, 2));
        lemmaCount++;
    }
    console.log(`Successfully processed ${lemmaCount} lemmas into ${LEMMAS_DIR}`);
}

main();
