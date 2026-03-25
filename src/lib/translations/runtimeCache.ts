import type { TranslationContent } from "@/lib/footnotes";

const translationCache = new Map<string, TranslationContent>();
const translationRequests = new Map<string, Promise<TranslationContent>>();

export function getCachedTranslationContent(requestKey: string): TranslationContent | undefined {
  return translationCache.get(requestKey);
}

export function setCachedTranslationContent(
  requestKey: string,
  content: TranslationContent,
): void {
  translationCache.set(requestKey, content);
}

export function getTranslationRequest(
  requestKey: string,
): Promise<TranslationContent> | undefined {
  return translationRequests.get(requestKey);
}

export function setTranslationRequest(
  requestKey: string,
  request: Promise<TranslationContent>,
): void {
  translationRequests.set(requestKey, request);
}

export function deleteTranslationRequest(requestKey: string): void {
  translationRequests.delete(requestKey);
}

export function clearTranslationRuntimeCache(): void {
  translationCache.clear();
  translationRequests.clear();
}
