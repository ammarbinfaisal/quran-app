import type { MushafCode, VbvSubmode } from "@/lib/types";

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

export function vbvPath(type: VbvSubmode, id: number, verse?: string | null): string {
  let path = `/v/${type}/${id}`;
  if (verse) path += `?verse=${verse}`;
  return path;
}

export function scrollPath(type: VbvSubmode, id: number, verse?: string | null): string {
  let path = `/s/${type}/${id}`;
  if (verse) path += `?verse=${verse}`;
  return path;
}

export function mushafPath(page: number, verse?: string | null): string {
  let path = `/p/${page}`;
  if (verse) path += `?verse=${verse}`;
  return path;
}

export function indopakMushafPath(page: number, verse?: string | null): string {
  let path = `/i/${page}`;
  if (verse) path += `?verse=${verse}`;
  return path;
}

export function indopakVbvPath(type: VbvSubmode, id: number, verse?: string | null): string {
  let path = `/iv/${type}/${id}`;
  if (verse) path += `?verse=${verse}`;
  return path;
}

export function indopakScrollPath(type: VbvSubmode, id: number, verse?: string | null): string {
  let path = `/is/${type}/${id}`;
  if (verse) path += `?verse=${verse}`;
  return path;
}

/** Returns a mushaf path for the given code */
export function mushafPathForCode(code: MushafCode, page: number, verse?: string | null): string {
  return code === "indopak" ? indopakMushafPath(page, verse) : mushafPath(page, verse);
}

/** Returns a VBV path for the given code */
export function vbvPathForCode(code: MushafCode, type: VbvSubmode, id: number, verse?: string | null): string {
  return code === "indopak" ? indopakVbvPath(type, id, verse) : vbvPath(type, id, verse);
}

/** Returns a scroll path for the given code */
export function scrollPathForCode(code: MushafCode, type: VbvSubmode, id: number, verse?: string | null): string {
  return code === "indopak" ? indopakScrollPath(type, id, verse) : scrollPath(type, id, verse);
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

export function parseScrollPath(pathname: string): { type: VbvSubmode; id: number } | null {
  const match = pathname.match(/^\/s\/(p|s|j)\/([0-9]+)/);
  if (!match) return null;
  return { type: match[1] as VbvSubmode, id: parseInt(match[2], 10) };
}

export function parseIndopakMushafPath(pathname: string): number | null {
  const match = pathname.match(/^\/i\/([0-9]+)/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

export function isVbvPath(pathname: string): boolean {
  return /^\/v\/(p|s|j)\/[0-9]+/.test(pathname);
}

export function isScrollPath(pathname: string): boolean {
  return /^\/s\/(p|s|j)\/[0-9]+/.test(pathname);
}

export function isMushafPath(pathname: string): boolean {
  return /^\/p\/[0-9]+/.test(pathname);
}

export function isIndopakMushafPath(pathname: string): boolean {
  return /^\/i\/[0-9]+/.test(pathname);
}

export function isIndopakVbvPath(pathname: string): boolean {
  return /^\/iv\/(p|s|j)\/[0-9]+/.test(pathname);
}

export function isIndopakScrollPath(pathname: string): boolean {
  return /^\/is\/(p|s|j)\/[0-9]+/.test(pathname);
}
