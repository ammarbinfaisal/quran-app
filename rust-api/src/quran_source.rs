use anyhow::{Context, Result};
use futures::stream::{FuturesUnordered, StreamExt};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Arc;
use tokio::fs;
use tokio::sync::Semaphore;

const API_BASE: &str = "https://api.quran.com/api/v4";
const TOTAL_PAGES: u16 = 604;
pub const DEFAULT_LOCAL_DATA_PATH: &str = "data/quran-uthmani.json";

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct VerseRecord {
    pub verse_key: String,
    pub surah: u16,
    pub ayah: u16,
    pub text_uthmani: String,
}

#[derive(Debug, Deserialize)]
struct LocalQuranData {
    verses: Vec<VerseRecord>,
}

#[derive(Debug, Deserialize)]
struct ByPageResponse {
    #[serde(default)]
    verses: Vec<ApiVerse>,
}

#[derive(Debug, Deserialize)]
struct ApiVerse {
    verse_key: String,
    text_uthmani: Option<String>,
    text_imlaei: Option<String>,
}

pub async fn load_quran_from_local<P: AsRef<Path>>(path: P) -> Result<Vec<VerseRecord>> {
    let path_ref = path.as_ref();
    let raw = fs::read_to_string(path_ref)
        .await
        .with_context(|| format!("failed reading local Quran data: {}", path_ref.display()))?;

    let payload: LocalQuranData = serde_json::from_str(&raw).with_context(|| {
        format!(
            "failed parsing local Quran data JSON: {}",
            path_ref.display()
        )
    })?;

    if payload.verses.is_empty() {
        anyhow::bail!("local Quran data has no verses: {}", path_ref.display());
    }

    Ok(payload.verses)
}

pub async fn load_quran_from_api(concurrency: usize) -> Result<Vec<VerseRecord>> {
    let client = Client::builder()
        .user_agent("quran-search-api/0.1")
        .build()
        .context("failed to build HTTP client")?;

    let semaphore = Arc::new(Semaphore::new(concurrency.max(1)));
    let mut tasks = FuturesUnordered::new();

    for page in 1..=TOTAL_PAGES {
        let client = client.clone();
        let semaphore = Arc::clone(&semaphore);
        tasks.push(tokio::spawn(async move {
            let permit = semaphore
                .acquire_owned()
                .await
                .context("semaphore closed")?;
            let result = fetch_page(&client, page).await;
            drop(permit);
            result
        }));
    }

    let mut deduped = BTreeMap::<(u16, u16), VerseRecord>::new();

    while let Some(joined) = tasks.next().await {
        let page_verses = joined.context("page fetch task panicked")??;
        for verse in page_verses {
            deduped.entry((verse.surah, verse.ayah)).or_insert(verse);
        }
    }

    Ok(deduped.into_values().collect())
}

async fn fetch_page(client: &Client, page: u16) -> Result<Vec<VerseRecord>> {
    let url = format!("{API_BASE}/verses/by_page/{page}");
    let response = client
        .get(url)
        .query(&[
            ("language", "ar"),
            ("fields", "text_uthmani"),
            ("per_page", "50"),
        ])
        .send()
        .await
        .with_context(|| format!("failed requesting page {page}"))?
        .error_for_status()
        .with_context(|| format!("non-success response for page {page}"))?;

    let payload: ByPageResponse = response
        .json()
        .await
        .with_context(|| format!("failed parsing JSON for page {page}"))?;

    let verses = payload
        .verses
        .into_iter()
        .filter_map(|v| {
            let text = v
                .text_uthmani
                .or(v.text_imlaei)
                .map(|t| t.trim().to_string())
                .unwrap_or_default();
            if text.is_empty() {
                return None;
            }

            parse_verse_key(&v.verse_key).map(|(surah, ayah)| VerseRecord {
                verse_key: v.verse_key,
                surah,
                ayah,
                text_uthmani: text,
            })
        })
        .collect();

    Ok(verses)
}

fn parse_verse_key(verse_key: &str) -> Option<(u16, u16)> {
    let (surah, ayah) = verse_key.split_once(':')?;
    let surah = surah.parse::<u16>().ok()?;
    let ayah = ayah.parse::<u16>().ok()?;
    Some((surah, ayah))
}
