type CrossMap = {
  v2ToIndopak: Record<number, number>;
  indopakToV2: Record<number, number>;
};

let cache: Promise<CrossMap> | null = null;

function loadCrossMap(): Promise<CrossMap> {
  cache ??= fetch("/data/page-map.v2-indopak.json").then(async (res) => {
    if (!res.ok) throw new Error(`Failed to load page-map.v2-indopak.json: ${res.status}`);
    return res.json() as Promise<CrossMap>;
  });
  return cache;
}

export async function v2PageToIndopak(v2Page: number): Promise<number> {
  const map = await loadCrossMap();
  return map.v2ToIndopak[v2Page] ?? 1;
}

export async function indopakPageToV2(indopakPage: number): Promise<number> {
  const map = await loadCrossMap();
  return map.indopakToV2[indopakPage] ?? 1;
}
