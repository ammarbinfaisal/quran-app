/**
 * Filename encoding for the per-root occurrence files in public/data/roots/.
 *
 * Buckwalter transliteration is case-sensitive — `d` is د but `D` is ض, `s`
 * is س but `S` is ص — so distinct roots differ only by letter case (dHw vs
 * DHw, Edd vs EDd vs EDD). macOS and Windows use case-insensitive
 * filesystems, so writing one file per root by its bare name silently
 * overwrites every root that differs only in case: 137 collision groups
 * covering 278 of the 1642 roots, with last-write-wins deciding the content.
 * Linux, where the site is built and served, keeps them apart — so the data
 * also differs between a developer's machine and production.
 *
 * Encoding uppercase as a lowercase letter followed by `-` makes the name
 * unambiguous under case folding while staying URL- and shell-safe.
 * `EDd` becomes `e-d-d`, `Edd` becomes `e-dd`, and the two no longer collide.
 */

/**
 * Buckwalter also uses a few punctuation characters for Arabic letters
 * ($ = ش, * = ذ, ' = ء, and so on). `*` is a shell glob and `'` needs
 * quoting, so they are spelled out rather than left in a filename.
 */
const SYMBOL_TO_NAME: Record<string, string> = {
  $: "0sh",
  "*": "0dh",
  "'": "0hamza",
  ">": "0alifhamza",
  "<": "0alifhamzabelow",
  "&": "0wawhamza",
  "}": "0yahamza",
  "|": "0alifmadda",
  "`": "0alifmaqsura",
  "{": "0alifwasla",
};

const NAME_TO_SYMBOL: Record<string, string> = Object.fromEntries(
  Object.entries(SYMBOL_TO_NAME).map(([symbol, name]) => [name, symbol]),
);

const SYMBOL_RE = new RegExp(
  `[${Object.keys(SYMBOL_TO_NAME)
    .map((s) => `\\${s}`)
    .join("")}]`,
  "g",
);
const NAME_RE = new RegExp(`(${Object.keys(NAME_TO_SYMBOL).join("|")})`, "g");

/** Convert a Buckwalter root to its case-insensitive-safe file basename. */
export function rootToFilename(root: string): string {
  return root
    .replace(SYMBOL_RE, (symbol) => SYMBOL_TO_NAME[symbol])
    .replace(/[A-Z]/g, (letter) => `${letter.toLowerCase()}-`);
}

/** Inverse of {@link rootToFilename}. */
export function filenameToRoot(filename: string): string {
  return filename
    .replace(/([a-z])-/g, (_, letter: string) => letter.toUpperCase())
    .replace(NAME_RE, (name) => NAME_TO_SYMBOL[name] ?? name);
}
