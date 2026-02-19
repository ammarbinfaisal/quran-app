// ---------------------------------------------------------------------------
// Abu Iyaad translation loader
// ---------------------------------------------------------------------------
// The JSON file at /data/abu-iyaad.json has the shape:
//   { "1:1": "translation text...", "2:5": "text...", ... }
// We fetch it once and cache in a module-level variable.
// ---------------------------------------------------------------------------

let cache: Record<string, string> | null = null;
let fetchPromise: Promise<Record<string, string>> | null = null;

/**
 * Load the full Abu Iyaad JSON dictionary.
 * Fetched once and cached in a module variable.
 */
export async function loadAbuIyaadData(): Promise<Record<string, string>> {
  if (cache) return cache;

  if (!fetchPromise) {
    fetchPromise = fetch("/data/abu-iyaad.json")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load abu-iyaad.json: ${res.status}`);
        return res.json() as Promise<Record<string, string>>;
      })
      .then((data) => {
        cache = data;
        return data;
      })
      .catch((err) => {
        fetchPromise = null;
        throw err;
      });
  }

  return fetchPromise;
}

/**
 * Load the Abu Iyaad translation for a single verse.
 * The full JSON is fetched once and cached in memory.
 */
export async function loadAbuIyaadTranslation(verseKey: string): Promise<string> {
  const data = await loadAbuIyaadData();
  return data[verseKey] ?? "";
}
