import { MUSHAF_ASSET_REV } from "@/lib/mushaf/assetRev";
import { MUSHAF_CODES } from "@/lib/types";
import { dbDelete, dbGetAllKeys } from "@/lib/offline/storage";

let prunePromise: Promise<void> | null = null;

function isCurrentRevisionKey(code: string, key: string) {
  return key.startsWith(`${code}:${MUSHAF_ASSET_REV}:`);
}

export async function ensureCurrentMushafAssetRevision(): Promise<void> {
  if (prunePromise) return prunePromise;

  prunePromise = (async () => {
    const [pageKeys, fontKeys] = await Promise.all([
      dbGetAllKeys("mushaf-pages").catch(() => [] as string[]),
      dbGetAllKeys("mushaf-fonts").catch(() => [] as string[]),
    ]);

    const stalePageDeletes: Promise<void>[] = [];
    const staleFontDeletes: Promise<void>[] = [];

    for (const code of MUSHAF_CODES) {
      for (const key of pageKeys) {
        if (key.startsWith(`${code}:`) && !isCurrentRevisionKey(code, key)) {
          stalePageDeletes.push(dbDelete("mushaf-pages", key));
        }
      }

      for (const key of fontKeys) {
        if (key.startsWith(`${code}:`) && !isCurrentRevisionKey(code, key)) {
          staleFontDeletes.push(dbDelete("mushaf-fonts", key));
        }
      }
    }

    await Promise.allSettled([...stalePageDeletes, ...staleFontDeletes]);
  })();

  try {
    await prunePromise;
  } catch {
    prunePromise = null;
  }
}
