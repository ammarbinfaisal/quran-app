import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import { rootToFilename } from '../src/lib/rootFilename';

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

// Roots are written under an encoded basename because Buckwalter is
// case-sensitive while macOS and Windows filesystems are not — see
// src/lib/rootFilename.ts. Writing `${root}.json` directly silently
// overwrote every root differing only in case.
let count = 0;
const written = new Map<string, string>();
for (const [root, occurrences] of Object.entries(roots)) {
    const filename = rootToFilename(root);
    const clash = written.get(filename.toLowerCase());
    if (clash) {
        throw new Error(
            `Filename collision: roots "${clash}" and "${root}" both map to "${filename}.json"`,
        );
    }
    written.set(filename.toLowerCase(), root);
    writeFileSync(path.join(ROOTS_DIR, `${filename}.json`), JSON.stringify(occurrences));
    count++;
}

console.log(`Generated ${count} root files in ${ROOTS_DIR}`);
