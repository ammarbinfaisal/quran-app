import { type } from "arktype";

export const SETTINGS_STORAGE_KEY = "quran-settings-v2";
export const SETTINGS_COOKIE_KEY = "quran-settings-v2";
export const SETTINGS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type RendererMushafLayout = "hafs-v2" | "hafs-v4" | "hafs-unicode";

export type MushafCode = "v1" | "v2" | "t4" | "ut" | "i5" | "i6" | "qh" | "tj";
export type TranslationCode = "n" | "d" | `tr${number}`;

export type MushafFont =
  | "code_v1"
  | "code_v2"
  | "tajweed_v4"
  | "text_uthmani"
  | "text_indopak"
  | "qpc_uthmani_hafs"
  | "tajweed";

export type MushafLines = "15_lines" | "16_lines";

export interface MushafVariant {
  code: MushafCode;
  mushafId: number;
  font: MushafFont;
  lines?: MushafLines;
  label: string;
  rendererLayout: RendererMushafLayout;
}

export const MUSHAF_VARIANTS: readonly MushafVariant[] = [
  {
    code: "v1",
    mushafId: 2,
    font: "code_v1",
    label: "Code V1",
    rendererLayout: "hafs-v2",
  },
  {
    code: "v2",
    mushafId: 1,
    font: "code_v2",
    label: "Code V2",
    rendererLayout: "hafs-v2",
  },
  {
    code: "t4",
    mushafId: 19,
    font: "tajweed_v4",
    label: "Tajweed V4",
    rendererLayout: "hafs-v4",
  },
  {
    code: "ut",
    mushafId: 4,
    font: "text_uthmani",
    label: "Uthmani Text",
    rendererLayout: "hafs-unicode",
  },
  {
    code: "i5",
    mushafId: 6,
    font: "text_indopak",
    lines: "15_lines",
    label: "Indopak 15 Lines",
    rendererLayout: "hafs-v2",
  },
  {
    code: "i6",
    mushafId: 7,
    font: "text_indopak",
    lines: "16_lines",
    label: "Indopak 16 Lines",
    rendererLayout: "hafs-v2",
  },
  {
    code: "qh",
    mushafId: 5,
    font: "qpc_uthmani_hafs",
    label: "QPC Uthmani Hafs",
    rendererLayout: "hafs-v2",
  },
  {
    code: "tj",
    mushafId: 11,
    font: "tajweed",
    label: "Tajweed",
    rendererLayout: "hafs-v2",
  },
] as const;

export const MUSHAF_VARIANTS_BY_CODE: Record<MushafCode, MushafVariant> = {
  v1: MUSHAF_VARIANTS[0],
  v2: MUSHAF_VARIANTS[1],
  t4: MUSHAF_VARIANTS[2],
  ut: MUSHAF_VARIANTS[3],
  i5: MUSHAF_VARIANTS[4],
  i6: MUSHAF_VARIANTS[5],
  qh: MUSHAF_VARIANTS[6],
  tj: MUSHAF_VARIANTS[7],
};

export interface Settings {
  apiTranslators: number[];
  showAbuIyaad: boolean;
  preferAbuIyaad: boolean;
  mushafCode: MushafCode;
  translationCode: TranslationCode;
  mushafLayout: RendererMushafLayout;
}

export const DEFAULT_SETTINGS: Settings = {
  apiTranslators: [20],
  showAbuIyaad: true,
  preferAbuIyaad: true,
  mushafCode: "v2",
  translationCode: "tr20",
  mushafLayout: "hafs-v2",
};

const mushafCodeSchema = type('"v1"|"v2"|"t4"|"ut"|"i5"|"i6"|"qh"|"tj"');
const rendererLayoutSchema = type('"hafs-v2"|"hafs-v4"|"hafs-unicode"');
const settingsSnapshotSchema = type({
  "apiTranslators?": "number[]",
  "showAbuIyaad?": "boolean",
  "preferAbuIyaad?": "boolean",
  "mushafCode?": '"v1"|"v2"|"t4"|"ut"|"i5"|"i6"|"qh"|"tj"',
  "translationCode?": "string",
  "mushafLayout?": '"hafs-v2"|"hafs-v4"|"hafs-unicode"',
});

interface SettingsSnapshot {
  apiTranslators?: number[];
  showAbuIyaad?: boolean;
  preferAbuIyaad?: boolean;
  mushafCode?: MushafCode;
  translationCode?: string;
  mushafLayout?: RendererMushafLayout;
}

function isArkErrors(value: unknown): value is InstanceType<typeof type.errors> {
  return value instanceof type.errors;
}

function asMushafCode(input: unknown): MushafCode | null {
  const parsed = mushafCodeSchema(input);
  return isArkErrors(parsed) ? null : parsed;
}

function asRendererLayout(input: unknown): RendererMushafLayout | null {
  const parsed = rendererLayoutSchema(input);
  return isArkErrors(parsed) ? null : parsed;
}

export function asTranslationCode(input: unknown): TranslationCode | null {
  if (typeof input !== "string") return null;
  if (input === "n" || input === "d") return input;
  if (!/^tr\d+$/.test(input)) return null;
  return input as TranslationCode;
}

function parseSettingsSnapshot(input: unknown): SettingsSnapshot | null {
  const parsed = settingsSnapshotSchema(input);
  return isArkErrors(parsed) ? null : (parsed as SettingsSnapshot);
}

function normalizeTranslatorIds(input: number[] | undefined): number[] {
  if (!input || input.length === 0) return [DEFAULT_SETTINGS.apiTranslators[0]];
  const deduped = Array.from(
    new Set(
      input
        .filter((id) => Number.isFinite(id))
        .map((id) => Math.floor(id))
        .filter((id) => id > 0)
    )
  );
  return deduped.length > 0 ? deduped : [DEFAULT_SETTINGS.apiTranslators[0]];
}

function inferMushafCode(
  mushafCode: MushafCode | undefined,
  mushafLayout: RendererMushafLayout | undefined
): MushafCode {
  if (mushafCode) return mushafCode;
  if (mushafLayout === "hafs-v4") return "t4";
  if (mushafLayout === "hafs-unicode") return "ut";
  return DEFAULT_SETTINGS.mushafCode;
}

export function resolveRendererLayout(mushafCode: MushafCode): RendererMushafLayout {
  return MUSHAF_VARIANTS_BY_CODE[mushafCode].rendererLayout;
}

function normalizeTranslationCode(
  translationCode: TranslationCode | null,
  translators: number[]
): TranslationCode {
  if (translationCode) return translationCode;
  return `tr${translators[0]}` as TranslationCode;
}

export function normalizeSettings(input: Partial<Settings>): Settings {
  const translators = normalizeTranslatorIds(input.apiTranslators);
  const mushafCode = inferMushafCode(input.mushafCode, input.mushafLayout);

  const translationCode = normalizeTranslationCode(
    asTranslationCode(input.translationCode),
    translators
  );

  if (translationCode.startsWith("tr")) {
    const id = Number(translationCode.slice(2));
    if (Number.isFinite(id) && id > 0 && !translators.includes(id)) {
      translators.unshift(id);
    }
  }

  return {
    apiTranslators: translators,
    showAbuIyaad: input.showAbuIyaad ?? DEFAULT_SETTINGS.showAbuIyaad,
    preferAbuIyaad: input.preferAbuIyaad ?? DEFAULT_SETTINGS.preferAbuIyaad,
    mushafCode,
    translationCode,
    mushafLayout: resolveRendererLayout(mushafCode),
  };
}

function parseSettingsValue(input: unknown): Settings {
  const parsed = parseSettingsSnapshot(input);
  if (!parsed) return DEFAULT_SETTINGS;

  const mushafCode = asMushafCode(parsed.mushafCode);
  const mushafLayout = asRendererLayout(parsed.mushafLayout);

  return normalizeSettings({
    apiTranslators: parsed.apiTranslators,
    showAbuIyaad: parsed.showAbuIyaad,
    preferAbuIyaad: parsed.preferAbuIyaad,
    mushafCode: mushafCode ?? undefined,
    mushafLayout: mushafLayout ?? undefined,
    translationCode: asTranslationCode(parsed.translationCode) ?? undefined,
  });
}

export function parseSettingsFromJson(raw: string | null | undefined): Settings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parseSettingsValue(parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function serializeSettingsForStorage(settings: Settings): string {
  return JSON.stringify(settings);
}

export function serializeSettingsCookie(settings: Settings): string {
  return encodeURIComponent(serializeSettingsForStorage(settings));
}

export function parseSettingsCookie(cookieValue: string | undefined): Settings {
  if (!cookieValue) return DEFAULT_SETTINGS;
  try {
    return parseSettingsFromJson(decodeURIComponent(cookieValue));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function persistSettingsToBrowser(settings: Settings) {
  if (typeof window === "undefined") return;

  const payload = serializeSettingsForStorage(settings);
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, payload);
  document.cookie = [
    `${SETTINGS_COOKIE_KEY}=${serializeSettingsCookie(settings)}`,
    "Path=/",
    `Max-Age=${SETTINGS_COOKIE_MAX_AGE}`,
    "SameSite=Lax",
  ].join("; ");
}

export function readSettingsFromLocalStorage(): Settings | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!stored) return null;
  return parseSettingsFromJson(stored);
}

export function settingsEqual(a: Settings, b: Settings): boolean {
  return serializeSettingsForStorage(a) === serializeSettingsForStorage(b);
}

function parseAyah(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const ayah = Number(value);
  return ayah > 0 ? ayah : null;
}

interface ParsedCanonicalTokens {
  mushafCode: MushafCode;
  translationCode: TranslationCode;
}

function parseCanonicalTokens(mToken: string, tToken: string): ParsedCanonicalTokens | null {
  if (!mToken.startsWith("m:") || !tToken.startsWith("t:")) return null;

  const mushafCode = asMushafCode(mToken.slice(2));
  const translationCode = asTranslationCode(tToken.slice(2));

  if (!mushafCode || !translationCode) return null;

  return { mushafCode, translationCode };
}

export type ReaderRouteParseResult =
  | {
      kind: "bare";
      ayah?: number;
    }
  | {
      kind: "canonical";
      ayah?: number;
      mushafCode: MushafCode;
      translationCode: TranslationCode;
    }
  | {
      kind: "invalid";
      reason: string;
    };

export function parseReaderRouteSegments(
  segments: string[] | undefined
): ReaderRouteParseResult {
  if (!segments || segments.length === 0) {
    return { kind: "bare" };
  }

  if (segments.length === 1) {
    const ayah = parseAyah(segments[0]);
    if (!ayah) return { kind: "invalid", reason: "Invalid ayah segment" };
    return { kind: "bare", ayah };
  }

  if (segments.length === 3 && segments[0] === "r") {
    const tokens = parseCanonicalTokens(segments[1], segments[2]);
    if (!tokens) return { kind: "invalid", reason: "Invalid canonical reader tokens" };
    return { kind: "canonical", ...tokens };
  }

  if (segments.length === 4 && segments[1] === "r") {
    const ayah = parseAyah(segments[0]);
    if (!ayah) return { kind: "invalid", reason: "Invalid ayah segment" };

    const tokens = parseCanonicalTokens(segments[2], segments[3]);
    if (!tokens) return { kind: "invalid", reason: "Invalid canonical reader tokens" };

    return { kind: "canonical", ayah, ...tokens };
  }

  return { kind: "invalid", reason: "Unsupported route pattern" };
}

export function buildCanonicalReaderPath(input: {
  surah: number;
  ayah?: number;
  mushafCode: MushafCode;
  translationCode: TranslationCode;
}): string {
  const base = input.ayah ? `/${input.surah}/${input.ayah}` : `/${input.surah}`;
  return `${base}/r/m:${input.mushafCode}/t:${input.translationCode}`;
}

export function getTranslationIdsForApi(settings: Settings): number[] {
  const translationCode = asTranslationCode(settings.translationCode);

  if (translationCode === "n") return [];

  if (translationCode && translationCode.startsWith("tr")) {
    const id = Number(translationCode.slice(2));
    return Number.isFinite(id) && id > 0 ? [id] : settings.apiTranslators;
  }

  return settings.apiTranslators;
}

export function getMushafVariantByCode(code: MushafCode): MushafVariant {
  return MUSHAF_VARIANTS_BY_CODE[code];
}
