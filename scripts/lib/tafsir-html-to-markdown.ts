import TurndownService from "turndown";

/**
 * Converts Quran.Foundation tafsir HTML into the markdown we store on disk.
 *
 * The source markup is narrow — across the whole corpus it is only
 * <p>, <h2>, <div class="arabic uthmani">, and a stray <span>/<strong>.
 * The one piece that carries meaning beyond formatting is the arabic div:
 * it wraps an embedded Qur'an or hadith quotation, and the reader needs to
 * keep rendering those in the Arabic face rather than as body copy. We map
 * them to blockquotes so the shape survives in plain markdown, and tag them
 * with the ﴿﴾ ornaments the Arabic tafsirs already use, which lets the
 * renderer detect them without a custom markdown extension.
 */

/** Arabic letters, plus the Arabic Presentation Forms blocks. */
const ARABIC_CHAR_RE = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g;
const LATIN_CHAR_RE = /[A-Za-z]/g;
const ARABIC_ORNAMENT_RE = /^[﴿«]/;

/**
 * True when a block is an Arabic quotation rather than English prose that
 * happens to contain a transliterated word or two. Compares Arabic against
 * Latin letter counts so a stray Latin citation inside a quote is tolerated.
 */
function isPredominantlyArabic(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const arabic = (trimmed.match(ARABIC_CHAR_RE) ?? []).length;
  if (arabic === 0) return false;
  const latin = (trimmed.match(LATIN_CHAR_RE) ?? []).length;
  return arabic > latin;
}

export function createTafsirTurndown(): TurndownService {
  const service = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    strongDelimiter: "**",
  });

  // Embedded Arabic quotations -> blockquote wrapped in ﴿ ﴾.
  //
  // The source is inconsistent about how it marks these: most carry
  // class="arabic uthmani", but many — especially in the shorter surahs —
  // are plain <p> elements whose only distinguishing feature is that their
  // content is Arabic script. Detect by content so both forms are caught.
  service.addRule("arabicQuote", {
    filter: (node) => {
      if (node.nodeName !== "DIV" && node.nodeName !== "P") return false;
      if ((node.getAttribute("class") ?? "").includes("arabic")) return true;
      return isPredominantlyArabic(node.textContent ?? "");
    },
    replacement: (content) => {
      const text = content.replace(/\s+/g, " ").trim();
      if (!text) return "";
      // The source separates consecutive quoted ayat with a lone dash in its
      // own block. It carries no text, so drop it rather than emit an empty
      // quotation.
      if (/^[-–—\\\s]+$/.test(text)) return "\n\n";
      const wrapped = ARABIC_ORNAMENT_RE.test(text) ? text : `﴿${text}﴾`;
      return `\n\n> ${wrapped}\n\n`;
    },
  });

  // Inline colour styling in the source is presentational noise, not emphasis.
  service.addRule("stripPresentationalSpans", {
    filter: (node) => node.nodeName === "SPAN" && node.hasAttribute("style"),
    replacement: (content) => content,
  });

  return service;
}

const service = createTafsirTurndown();

export function tafsirHtmlToMarkdown(html: string): string {
  if (!html) return "";
  return (
    service
      .turndown(html)
      // Turndown escapes punctuation that could be markdown syntax, but this
      // corpus has no code, links or emphasis markup — the characters are
      // literal. Backticks and apostrophes carry `Ka`b`-style transliteration,
      // and brackets carry editorial insertions like [Sahih].
      .replace(/\\([`[\]*_])/g, "$1")
      // "4\. Allah's statement" — the source numbers points inline as prose,
      // not as a list. Turndown escapes the dot to stop markdown turning them
      // into an <ol>; since each is a standalone paragraph, unescaping keeps
      // the numbering readable without creating a spurious list.
      .replace(/^(\d+)\\\./gm, "$1.")
      // A leading "\-" is the source's own bullet for a list of names or
      // titles; restore it as a real markdown list item.
      .replace(/^\\-\s+/gm, "- ")
      // Any other escaped dash or backslash is a literal character. The
      // source itself contains a few stray backslashes before quote marks;
      // those are typos in the original text, so drop them too.
      .replace(/\\([-\\])/g, "$1")
      .replace(/\\(?=["”'’])/g, "")
      // Collapse the runs of blank lines the block rules can leave behind.
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
