use crate::normalization::normalize_arabic;
use crate::quran_source::VerseRecord;
use needle::BoyerMoore;
use serde::Serialize;

#[derive(Debug, Clone)]
pub struct IndexedVerse {
    pub verse_key: String,
    pub surah: u16,
    pub ayah: u16,
    pub text_uthmani: String,
    pub normalized: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SearchHit {
    pub verse_key: String,
    pub surah: u16,
    pub ayah: u16,
    pub text_uthmani: String,
}

pub fn build_index(verses: Vec<VerseRecord>) -> Vec<IndexedVerse> {
    verses
        .into_iter()
        .map(|v| IndexedVerse {
            normalized: normalize_arabic(&v.text_uthmani),
            verse_key: v.verse_key,
            surah: v.surah,
            ayah: v.ayah,
            text_uthmani: v.text_uthmani,
        })
        .collect()
}

pub fn find_matches(indexed: &[IndexedVerse], normalized_query: &str) -> Vec<SearchHit> {
    let needle = normalized_query.as_bytes();
    let matcher = BoyerMoore::new(needle);

    indexed
        .iter()
        .filter_map(|verse| {
            let haystack = verse.normalized.as_bytes();
            if haystack.len() < needle.len() {
                return None;
            }
            let found = matcher.find_first_in(haystack).is_some();
            if found {
                Some(SearchHit {
                    verse_key: verse.verse_key.clone(),
                    surah: verse.surah,
                    ayah: verse.ayah,
                    text_uthmani: verse.text_uthmani.clone(),
                })
            } else {
                None
            }
        })
        .collect()
}
