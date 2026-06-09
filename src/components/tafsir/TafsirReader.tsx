"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useApplyPreferences } from "@/hooks/useApplyPreferences";
import { useChapters } from "@/hooks/useChapters";
import { useMountEffect } from "@/hooks/useMountEffect";
import { usePreferences } from "@/hooks/usePreferences";
import { ArabicVerseBlock } from "@/components/ayah/ArabicVerseBlock";
import { WordTapSheets } from "@/components/ayah/WordTapSheets";
import { SurahHeader } from "@/components/mushaf/SurahHeader";
import { ReaderBottomNav } from "@/components/navigation/ReaderBottomNav";
import NavigationPicker from "@/components/nav/NavigationPicker";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import { TafsirSwitcher } from "@/components/tafsir/TafsirSwitcher";
import { fetchVersePages } from "@/lib/navigation/maps";
import {
  loadTafsirAvailability,
  loadTafsirEntry,
  getAvailableTafsirIds,
  getTafsirAvailabilitySync,
  type TafsirAvailability,
  type TafsirEntry,
} from "@/lib/tafsir/loader";
import { scheduleTafsirPrefetch } from "@/lib/tafsir/prefetch";
import {
  TAFSIR_DISPLAY_NAMES,
  TAFSIR_IDS,
  type TafsirId,
} from "@/lib/types";
import { formatVerseRangeReference } from "@/lib/recitationRange";
import { sortTafsirIdsByPreference } from "@/lib/tafsir/order";
import { tafsirPath, vbvPath } from "@/lib/url";
import type { WordTapTarget } from "@/lib/wordTap";

export function TafsirReader({
  tafsirId,
  surahId,
  ayahId,
}: {
  tafsirId: TafsirId;
  surahId: number;
  ayahId: number;
}) {
  const router = useRouter();
  const chapters = useChapters();
  const { prefs } = usePreferences();
  useApplyPreferences();

  const chapter = chapters.find((c) => c.id === surahId);
  const verseKey = `${surahId}:${ayahId}`;

  const [activeTafsir, setActiveTafsir] = useState<TafsirId>(tafsirId);
  const [tafsirEntry, setTafsirEntry] = useState<TafsirEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingTafsir, setPendingTafsir] = useState<TafsirId | null>(null);
  const [availability, setAvailability] = useState<TafsirAvailability | null>(
    () => getTafsirAvailabilitySync(),
  );
  const [selectedTap, setSelectedTap] = useState<WordTapTarget | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Load availability manifest + active tafsir on mount. Keyed component —
  // page.tsx remounts us on every URL change, so mount is the right scope.
  useMountEffect(() => {
    let cancelled = false;

    (async () => {
      const [manifest, entry] = await Promise.all([
        loadTafsirAvailability(),
        loadTafsirEntry(activeTafsir, surahId, ayahId),
      ]);
      if (cancelled) return;
      setAvailability(manifest);
      setTafsirEntry(entry);
      setLoading(false);

      if (chapter) {
        scheduleTafsirPrefetch({
          dataUsageMode: prefs.dataUsageMode,
          activeTafsirId: activeTafsir,
          surahId,
          ayahId,
          surahAyahCount: chapter.versesCount,
          tafsirOrder: prefs.tafsirOrder,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  });

  // Warm the verse-to-page map so ArabicVerseBlock can resolve glyph fonts
  // without a cold fetch on first render.
  useMountEffect(() => {
    fetchVersePages(prefs.mushafCode).catch(() => {});
  });

  const navigatePrev = useCallback(() => {
    if (ayahId > 1) {
      router.push(tafsirPath(activeTafsir, surahId, ayahId - 1));
      return;
    }
    const prev = chapters.find((c) => c.id === surahId - 1);
    if (prev) router.push(tafsirPath(activeTafsir, prev.id, prev.versesCount));
  }, [router, activeTafsir, surahId, ayahId, chapters]);

  const navigateNext = useCallback(() => {
    if (chapter && ayahId < chapter.versesCount) {
      router.push(tafsirPath(activeTafsir, surahId, ayahId + 1));
      return;
    }
    if (surahId < 114) {
      router.push(tafsirPath(activeTafsir, surahId + 1, 1));
    }
  }, [router, activeTafsir, surahId, ayahId, chapter]);

  // Keyboard arrows — RTL-aware. Right arrow → previous, left → next.
  useMountEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        navigatePrev();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigateNext();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const availableIds = useMemo<readonly TafsirId[]>(
    () => {
      const ids = getAvailableTafsirIds(availability, surahId, ayahId);
      return sortTafsirIdsByPreference(ids ?? TAFSIR_IDS, prefs.tafsirOrder);
    },
    [availability, prefs.tafsirOrder, surahId, ayahId],
  );

  const handleTafsirSwitch = useCallback(
    async (next: TafsirId) => {
      if (next === activeTafsir) return;
      setPendingTafsir(next);
      setActiveTafsir(next);
      setTafsirEntry(null);
      setLoading(true);

      const entry = await loadTafsirEntry(next, surahId, ayahId);
      setTafsirEntry(entry);
      setLoading(false);
      setPendingTafsir(null);

      // Keep the page mounted — just reflect the new tafsir in the URL.
      window.history.replaceState(null, "", tafsirPath(next, surahId, ayahId));

      if (chapter) {
        scheduleTafsirPrefetch({
          dataUsageMode: prefs.dataUsageMode,
          activeTafsirId: next,
          surahId,
          ayahId,
          surahAyahCount: chapter.versesCount,
          tafsirOrder: prefs.tafsirOrder,
        });
      }
    },
    [activeTafsir, surahId, ayahId, chapter, prefs.dataUsageMode, prefs.tafsirOrder],
  );

  const canGoPrev = ayahId > 1 || surahId > 1;
  const canGoNext = chapter ? ayahId < chapter.versesCount || surahId < 114 : false;

  const rangeLabel = useMemo(() => {
    if (!tafsirEntry?.ayahsStart || !tafsirEntry?.count || tafsirEntry.count <= 1) return null;
    const startKey = `${surahId}:${tafsirEntry.ayahsStart}`;
    const endKey = `${surahId}:${tafsirEntry.ayahsStart + tafsirEntry.count - 1}`;
    return formatVerseRangeReference(startKey, endKey, chapters);
  }, [tafsirEntry, surahId, chapters]);

  const attributionUrl = `https://tafsir.app/${activeTafsir}/${surahId}/${ayahId}`;

  const handleWordTap = useCallback((target: WordTapTarget) => {
    setSelectedTap(target);
  }, []);

  return (
    <main className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto min-h-0 bg-[var(--color-bg)]">
        <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6 animate-fade-in">
          {ayahId === 1 && chapter && (
            <div className="mb-6">
              <SurahHeader
                nameSimple={chapter.nameSimple}
                surahNumber={chapter.id}
                variant="viewer"
                showBismillah={
                  !!chapter.bismillahPre && chapter.id !== 1 && chapter.id !== 9
                }
              />
            </div>
          )}

          <section className="mb-6 rounded-xl border border-[var(--color-muted)]/15 bg-[var(--color-surface)] px-5 pb-5 pt-4">
            <header className="mb-3 flex items-center justify-between">
              <a
                href={vbvPath("s", surahId, verseKey)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-muted)] tabular-nums hover:text-[var(--color-accent)] transition-colors"
                aria-label={`Open ${verseKey} in reader`}
              >
                <span>{chapter?.nameSimple}</span>
                <span aria-hidden>·</span>
                <span>{verseKey}</span>
              </a>
              <span className="font-arabic text-sm text-[var(--color-muted)]" dir="rtl">
                {chapter?.nameArabic}
              </span>
            </header>

            <ArabicVerseBlock
              verseKey={verseKey}
              mushafCode={prefs.mushafCode}
              onWordTap={handleWordTap}
              fontScale={prefs.fontScale ?? 1}
              label={verseKey}
              compact
            />
          </section>

          <div className="mb-4">
            <TafsirSwitcher
              active={activeTafsir}
              onChange={handleTafsirSwitch}
              available={availableIds}
              pending={pendingTafsir}
            />
          </div>

          <article className="rounded-xl border border-[var(--color-muted)]/15 bg-[var(--color-surface)] p-5">
            <header className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--color-text)]">
                {TAFSIR_DISPLAY_NAMES[activeTafsir]}
              </h2>
              <a
                href={attributionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-accent)] transition"
              >
                tafsir.app
                <ExternalLink className="h-3 w-3" />
              </a>
            </header>

            {rangeLabel && (
              <div className="mb-3 text-xs text-[var(--color-muted)]">
                Covers ayaat {rangeLabel}
              </div>
            )}

            {loading ? (
              <TafsirSkeleton />
            ) : tafsirEntry?.text ? (
              <TafsirContent html={tafsirEntry.text} fontScale={prefs.fontScale ?? 1} />
            ) : (
              <p className="py-4 text-center text-sm text-[var(--color-muted)]">
                No tafsir available for this ayah.
              </p>
            )}
          </article>
        </div>
      </div>

      <ReaderBottomNav
        showBack
        visible
        centerClassName="gap-2"
        centerLabel={{
          icon: <BookOpen className="h-4 w-4 text-[var(--color-muted)]" />,
          text: verseKey,
          ariaLabel: `Verse ${verseKey} — open navigation`,
          onClick: () => setPickerOpen(true),
          size: "sm",
        }}
        centerExtra={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={navigatePrev}
              disabled={!canGoPrev}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition"
              aria-label="Previous ayah"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={navigateNext}
              disabled={!canGoNext}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition"
              aria-label="Next ayah"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        }
        showModeToggle={false}
        showRecitation={false}
        onSettingsClick={() => setSettingsOpen(true)}
      />

      <WordTapSheets
        selectedTap={selectedTap}
        translationIds={prefs.translationIds}
        mushafCode={prefs.mushafCode}
        onRetargetTap={setSelectedTap}
        onClose={() => setSelectedTap(null)}
      />

      <NavigationPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        initialPage={null}
        initialVerseKey={verseKey}
        onNavigate={(_page, nextVerseKey) => {
          setPickerOpen(false);
          if (!nextVerseKey) return;
          const [sPart, aPart] = nextVerseKey.split(":");
          const sNum = Number.parseInt(sPart, 10);
          const aNum = Number.parseInt(aPart, 10);
          if (!Number.isFinite(sNum) || !Number.isFinite(aNum)) return;
          router.push(tafsirPath(activeTafsir, sNum, aNum));
        }}
      />

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  );
}

function TafsirSkeleton() {
  return (
    <div className="space-y-2 py-2">
      <div className="h-4 w-full rounded bg-[var(--color-muted)]/15 animate-pulse" />
      <div className="h-4 w-full rounded bg-[var(--color-muted)]/15 animate-pulse" />
      <div className="h-4 w-4/5 rounded bg-[var(--color-muted)]/15 animate-pulse" />
      <div className="h-4 w-full rounded bg-[var(--color-muted)]/15 animate-pulse" />
      <div className="h-4 w-3/5 rounded bg-[var(--color-muted)]/15 animate-pulse" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tafsir content parser + renderer
//
// Our scraped tafsir JSON follows tafsir.app conventions (plain text, no tags).
// We replicate their client-side rendering rules:
//   [[...]]                -> numbered superscript; body collected as footnote
//   ﴿...﴾ / «...» / {...}  -> Quran/hadith quote, accented
//   [سورة: N]              -> verse reference chip
//   * line                 -> subheading (bold)
//   ؎ line                 -> poetry line
//   ⁕ / * only             -> decorative separator
//   (p-N)                  -> manuscript page marker, stripped
// ---------------------------------------------------------------------------

type InlineSegment =
  | { kind: "text"; value: string }
  | { kind: "quote"; value: string }
  | { kind: "ref"; value: string }
  | { kind: "footnote"; n: number };

type Block =
  | { kind: "heading"; segments: InlineSegment[] }
  | { kind: "poetry"; segments: InlineSegment[] }
  | { kind: "separator"; value: string }
  | { kind: "paragraph"; segments: InlineSegment[] };

interface ParsedTafsir {
  blocks: Block[];
  footnotes: InlineSegment[][];
}

const INLINE_RE =
  /(﴿[\s\S]*?﴾)|(«[\s\S]*?»)|(\{[\s\S]*?\})|(\[[ء-ْ ]{1,11}:\s*[\d٠-٩،\s-]+\])|␞(\d+)␟/g;
const FOOTNOTE_EXTRACT_RE = /\s?\[\[([\s\S]*?\]*)\]\]/g;
const PAGE_MARKER_RE = /\(p-[\d٠-٩]+\)/g;
const SEPARATOR_RE = /^[⁕*\s]+$/;

function toArabicNum(n: number): string {
  return String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);
}

function parseInline(s: string): InlineSegment[] {
  const out: InlineSegment[] = [];
  let last = 0;
  for (const m of s.matchAll(INLINE_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ kind: "text", value: s.slice(last, idx) });
    if (m[1] || m[2] || m[3]) {
      out.push({ kind: "quote", value: m[1] ?? m[2] ?? m[3] });
    } else if (m[4]) {
      out.push({ kind: "ref", value: m[4] });
    } else if (m[5]) {
      out.push({ kind: "footnote", n: parseInt(m[5], 10) });
    }
    last = idx + m[0].length;
  }
  if (last < s.length) out.push({ kind: "text", value: s.slice(last) });
  return out;
}

function parseTafsir(raw: string): ParsedTafsir {
  const footnoteSrc: string[] = [];
  let text = raw.replace(FOOTNOTE_EXTRACT_RE, (_, body) => {
    const idx = footnoteSrc.length;
    footnoteSrc.push(String(body).trim());
    return `␞${idx}␟`;
  });
  text = text.replace(PAGE_MARKER_RE, "");

  const blocks: Block[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (SEPARATOR_RE.test(line) && /[⁕*]/.test(line)) {
      blocks.push({ kind: "separator", value: line });
      continue;
    }
    if (line.startsWith("*")) {
      blocks.push({ kind: "heading", segments: parseInline(line.replace(/^\*\s*/, "")) });
      continue;
    }
    if (line.startsWith("؎")) {
      blocks.push({ kind: "poetry", segments: parseInline(line.replace(/^؎\s*/, "")) });
      continue;
    }
    blocks.push({ kind: "paragraph", segments: parseInline(line) });
  }

  return { blocks, footnotes: footnoteSrc.map(parseInline) };
}

function InlineSegments({
  segments,
  onFootnoteClick,
}: {
  segments: InlineSegment[];
  onFootnoteClick?: (n: number) => void;
}) {
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === "quote") {
          return (
            <span key={i} className="text-[var(--color-accent)] font-medium">
              {seg.value}
            </span>
          );
        }
        if (seg.kind === "ref") {
          return (
            <span
              key={i}
              className="mx-0.5 inline-block rounded bg-[var(--color-surface)] px-1.5 py-0.5 text-[0.78em] text-[var(--color-muted)] align-baseline tabular-nums"
            >
              {seg.value}
            </span>
          );
        }
        if (seg.kind === "footnote") {
          const label = toArabicNum(seg.n + 1);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onFootnoteClick?.(seg.n)}
              className="mx-0.5 align-super text-[0.7em] font-semibold text-[var(--color-accent)] hover:underline tabular-nums"
              aria-label={`حاشية ${label}`}
            >
              ({label})
            </button>
          );
        }
        return <span key={i}>{seg.value}</span>;
      })}
    </>
  );
}

function TafsirContent({ html, fontScale }: { html: string; fontScale: number }) {
  const { blocks, footnotes } = useMemo(() => parseTafsir(html), [html]);
  const fontSize = `clamp(1.05rem, ${fontScale * 0.09 + 1}rem, 1.7rem)`;

  const scrollToFootnote = useCallback((n: number) => {
    const el = document.getElementById(`fn-${n}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-[var(--color-accent)]");
    window.setTimeout(
      () => el.classList.remove("ring-2", "ring-[var(--color-accent)]"),
      1400,
    );
  }, []);

  return (
    <div
      className="font-arabic leading-[2] text-[var(--color-text)] space-y-3"
      dir="rtl"
      style={{ fontSize }}
    >
      {blocks.map((block, i) => {
        if (block.kind === "separator") {
          return (
            <div
              key={i}
              className="my-4 flex items-center justify-center text-[var(--color-muted)]/60 select-none"
              aria-hidden
            >
              {block.value}
            </div>
          );
        }
        if (block.kind === "heading") {
          return (
            <h3
              key={i}
              className="pt-2 first:pt-0 font-semibold text-[var(--color-accent)]"
            >
              <InlineSegments segments={block.segments} onFootnoteClick={scrollToFootnote} />
            </h3>
          );
        }
        if (block.kind === "poetry") {
          return (
            <p
              key={i}
              className="mx-auto max-w-[32em] text-center italic text-[var(--color-text)]/90"
            >
              <InlineSegments segments={block.segments} onFootnoteClick={scrollToFootnote} />
            </p>
          );
        }
        return (
          <p key={i}>
            <InlineSegments segments={block.segments} onFootnoteClick={scrollToFootnote} />
          </p>
        );
      })}

      {footnotes.length > 0 && (
        <div className="mt-6 border-t border-[var(--color-muted)]/20 pt-4">
          <ol
            className="space-y-2 list-none text-[var(--color-muted)]"
            style={{ fontSize: `clamp(0.85rem, ${fontScale * 0.07 + 0.82}rem, 1.3rem)` }}
          >
            {footnotes.map((segments, n) => (
              <li
                id={`fn-${n}`}
                key={n}
                className="flex gap-2 items-baseline rounded-md p-1 transition-[box-shadow]"
              >
                <span className="shrink-0 font-semibold tabular-nums text-[var(--color-accent)]">
                  ({toArabicNum(n + 1)})
                </span>
                <span className="flex-1 leading-[1.8]">
                  <InlineSegments segments={segments} onFootnoteClick={scrollToFootnote} />
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
