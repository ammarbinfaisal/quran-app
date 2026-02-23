/**
 * Maps Buckwalter transliteration to standard Arabic characters.
 */
const buckwalterMap: Record<string, string> = {
    // Letters
    "'": "ء",
    "|": "آ",
    ">": "أ",
    "&": "ؤ",
    "<": "إ",
    "}": "ئ",
    "A": "ا",
    "b": "ب",
    "p": "ة",
    "t": "ت",
    "v": "ث",
    "j": "ج",
    "H": "ح",
    "x": "خ",
    "d": "د",
    "*": "ذ",
    "r": "ر",
    "z": "ز",
    "s": "س",
    "$": "ش",
    "S": "ص",
    "D": "ض",
    "T": "ط",
    "Z": "ظ",
    "E": "ع",
    "g": "غ",
    "_": "ـ",
    "f": "ف",
    "q": "ق",
    "k": "ك",
    "l": "ل",
    "m": "م",
    "n": "ن",
    "h": "ه",
    "w": "و",
    "Y": "ى",
    "y": "ي",
    // Diacritics
    "F": "ً",
    "N": "ٌ",
    "K": "ٍ",
    "a": "َ",
    "u": "ُ",
    "i": "ِ",
    "~": "ّ",
    "o": "ْ",
    "^": "ٰ",
    "`": "ٰ",
    "{": "ٱ",
    ":": "ۜ",
    "@": "۟",
    "\"": "ۡ",
    "[": "ۙ",
    "]": "ۚ",
};

const arabicToBuckwalterMap: Record<string, string> = {};

// Build inverse map
for (const [bw, ar] of Object.entries(buckwalterMap)) {
    arabicToBuckwalterMap[ar] = bw;
}

/**
 * Converts Buckwalter transliteration to standard Arabic.
 */
export function buckwalterToArabic(text: string): string {
    if (!text) return text;
    return text.split('').map(char => buckwalterMap[char] || char).join('');
}

/**
 * Converts standard Arabic to Buckwalter transliteration.
 */
export function arabicToBuckwalter(text: string): string {
    if (!text) return text;
    return text.split('').map(char => arabicToBuckwalterMap[char] || char).join('');
}

