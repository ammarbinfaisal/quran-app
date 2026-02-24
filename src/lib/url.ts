import type { VbvSubmode } from "@/lib/types";

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

export function vbvPath(type: VbvSubmode, id: number, verse?: string | null): string {
  let path = `/v/${type}/${id}`;
  if (verse) path += `?verse=${verse}`;
  return path;
}

export function mushafPath(page: number, verse?: string | null): string {
  let path = `/p/${page}`;
  if (verse) path += `?verse=${verse}`;
  return path;
}

export function lemmaPath(buckwalterLemma: string): string {
  return `/m/${encodeURIComponent(buckwalterLemma)}`;
}

export function rootPath(buckwalterRoot: string): string {
  return `/r/${encodeURIComponent(buckwalterRoot)}`;
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

export function parseVbvPath(pathname: string): { type: VbvSubmode; id: number } | null {
  const match = pathname.match(/^\/v\/(p|s|j)\/([0-9]+)/);
  if (!match) return null;
  return { type: match[1] as VbvSubmode, id: parseInt(match[2], 10) };
}

export function isVbvPath(pathname: string): boolean {
  return /^\/v\/(p|s|j)\/[0-9]+/.test(pathname);
}

export function isMushafPath(pathname: string): boolean {
  return /^\/p\/[0-9]+/.test(pathname);
}
