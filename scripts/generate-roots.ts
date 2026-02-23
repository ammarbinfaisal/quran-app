import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import path from 'path';

const MORPHOLOGY_DIR = path.join(process.cwd(), 'public/data/morphology');
const ROOTS_DIR = path.join(process.cwd(), 'public/data/roots');

if (!existsSync(ROOTS_DIR)) {
    mkdirSync(ROOTS_DIR, { recursive: true });
}

const roots: Record<string, { surah: number; ayah: number; word: number }[]> = {};

const files = readdirSync(MORPHOLOGY_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();

for (const file of files) {
    const data = JSON.parse(readFileSync(path.join(MORPHOLOGY_DIR, file), 'utf-8')) as Record<
        string,
        { features?: { root?: string } }[]
    >;

    for (const [key, segments] of Object.entries(data)) {
        const parts = key.split(':');
        const surah = parseInt(parts[0]);
        const ayah = parseInt(parts[1]);
        const word = parseInt(parts[2]);

        const seenRoots = new Set<string>();
        for (const seg of segments) {
            const root = seg.features?.root;
            if (root && !seenRoots.has(root)) {
                seenRoots.add(root);
                if (!roots[root]) roots[root] = [];
                const last = roots[root].at(-1);
                if (!last || last.surah !== surah || last.ayah !== ayah || last.word !== word) {
                    roots[root].push({ surah, ayah, word });
                }
            }
        }
    }
}

let count = 0;
for (const [root, occurrences] of Object.entries(roots)) {
    writeFileSync(path.join(ROOTS_DIR, `${root}.json`), JSON.stringify(occurrences));
    count++;
}

console.log(`Generated ${count} root files in ${ROOTS_DIR}`);
