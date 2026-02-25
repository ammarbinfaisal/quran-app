export interface QuranSearchHit {
  verse_key: string;
  surah: number;
  ayah: number;
  text_uthmani: string;
}

export interface QuranSearchResponse {
  query: string;
  normalized_query: string;
  total_matches: number;
  limited_to: number;
  cache_hit: boolean;
  results: QuranSearchHit[];
}
