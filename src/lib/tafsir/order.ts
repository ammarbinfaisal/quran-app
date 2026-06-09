import { TAFSIR_IDS, type TafsirId } from "@/lib/types";

const VALID_SET = new Set<TafsirId>(TAFSIR_IDS);

export function normalizeTafsirOrder(
  order: readonly TafsirId[] | undefined | null,
): TafsirId[] {
  if (!order || order.length === 0) return [...TAFSIR_IDS];

  const seen = new Set<TafsirId>();
  const result: TafsirId[] = [];
  for (const id of order) {
    if (VALID_SET.has(id) && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  for (const id of TAFSIR_IDS) {
    if (!seen.has(id)) result.push(id);
  }
  return result;
}

export function sortTafsirIdsByPreference(
  ids: readonly TafsirId[],
  order: readonly TafsirId[] | undefined | null,
): TafsirId[] {
  const normalized = normalizeTafsirOrder(order);
  const rank = new Map(normalized.map((id, i) => [id, i]));
  return [...ids].sort((a, b) => (rank.get(a) ?? 99) - (rank.get(b) ?? 99));
}
