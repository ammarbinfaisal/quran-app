mod normalization;
mod quran_source;
mod search;

use anyhow::{Context, Result};
use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use lru::LruCache;
use serde::{Deserialize, Serialize};
use std::num::NonZeroUsize;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::net::TcpListener;
use tokio::sync::RwLock;
use tracing::info;

use normalization::normalize_arabic;
use quran_source::{load_quran_from_api, load_quran_from_local, DEFAULT_LOCAL_DATA_PATH};
use search::{build_index, find_matches, IndexedVerse, SearchHit};

#[derive(Clone)]
struct AppState {
    source: Arc<RwLock<SourceState>>,
    cache: Arc<Mutex<LruCache<String, Arc<Vec<SearchHit>>>>>,
    fetch_concurrency: usize,
    data_path: String,
}

struct SourceState {
    verses: Arc<Vec<IndexedVerse>>,
    loaded_at_unix: u64,
    source_label: String,
}

#[derive(Debug, Deserialize)]
struct SearchQuery {
    q: String,
    limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
struct ReloadQuery {
    source: Option<String>,
}

#[derive(Debug, Serialize)]
struct SearchResponse {
    query: String,
    normalized_query: String,
    total_matches: usize,
    limited_to: usize,
    cache_hit: bool,
    results: Vec<SearchHit>,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: &'static str,
    source: String,
    verses_loaded: usize,
    loaded_at_unix: u64,
    cached_queries: usize,
}

#[derive(Debug, Serialize)]
struct ReloadResponse {
    ok: bool,
    source: String,
    verses_loaded: usize,
    loaded_at_unix: u64,
}

#[derive(Debug, Serialize)]
struct ApiError {
    error: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "quran_search_api=info,info".to_string()),
        )
        .init();

    let port = env_usize("PORT", 8080) as u16;
    let fetch_concurrency = env_usize("QURAN_FETCH_CONCURRENCY", 16);
    let cache_capacity = env_usize("SEARCH_CACHE_CAPACITY", 512);
    let data_path =
        std::env::var("QURAN_DATA_PATH").unwrap_or_else(|_| DEFAULT_LOCAL_DATA_PATH.to_string());
    let allow_api_fallback = env_bool("QURAN_ALLOW_API_FALLBACK", false);

    info!("loading Quran verses from local dataset: {}", data_path);
    let (verses, source_label) = match load_quran_from_local(&data_path).await {
        Ok(verses) => (verses, format!("local file ({})", data_path)),
        Err(local_err) if allow_api_fallback => {
            info!("local dataset load failed, falling back to API: {local_err:#}");
            let verses = load_quran_from_api(fetch_concurrency)
                .await
                .context("failed loading Quran text from API fallback")?;
            (verses, "Quran Foundation API fallback".to_string())
        }
        Err(local_err) => {
            return Err(local_err).with_context(|| {
                format!(
                    "local Quran dataset is required. Run: python3 scripts/fetch_quran_text.py --output {}",
                    data_path
                )
            });
        }
    };

    let source = SourceState {
        verses: Arc::new(build_index(verses)),
        loaded_at_unix: unix_now(),
        source_label,
    };

    let state = AppState {
        source: Arc::new(RwLock::new(source)),
        cache: Arc::new(Mutex::new(LruCache::new(
            NonZeroUsize::new(cache_capacity.max(1)).expect("cache capacity must be non-zero"),
        ))),
        fetch_concurrency,
        data_path,
    };

    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/search", get(search_handler))
        .route("/reload", post(reload_handler))
        .with_state(state);

    let bind_addr = format!("0.0.0.0:{port}");
    let listener = TcpListener::bind(&bind_addr).await?;
    info!("quran-search-api listening on {bind_addr}");
    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_handler(State(state): State<AppState>) -> impl IntoResponse {
    let source = state.source.read().await;
    let cached_queries = {
        let cache = state.cache.lock().expect("search cache poisoned");
        cache.len()
    };

    Json(HealthResponse {
        status: "ok",
        source: source.source_label.clone(),
        verses_loaded: source.verses.len(),
        loaded_at_unix: source.loaded_at_unix,
        cached_queries,
    })
}

async fn search_handler(
    State(state): State<AppState>,
    Query(params): Query<SearchQuery>,
) -> impl IntoResponse {
    let query = params.q.trim();
    if query.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiError {
                error: "query parameter 'q' is required".to_string(),
            }),
        )
            .into_response();
    }

    let normalized_query = normalize_arabic(query);
    if normalized_query.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiError {
                error: "query became empty after normalization".to_string(),
            }),
        )
            .into_response();
    }

    let limit = params.limit.unwrap_or(50).clamp(1, 500);

    let cached_hits = {
        let mut cache = state.cache.lock().expect("search cache poisoned");
        cache.get(&normalized_query).cloned()
    };

    let (hits, cache_hit) = if let Some(cached) = cached_hits {
        (cached, true)
    } else {
        let source = state.source.read().await;
        let computed = Arc::new(find_matches(&source.verses, &normalized_query));
        let mut cache = state.cache.lock().expect("search cache poisoned");
        cache.put(normalized_query.clone(), Arc::clone(&computed));
        (computed, false)
    };

    let total_matches = hits.len();
    let results = hits.iter().take(limit).cloned().collect::<Vec<_>>();

    (
        StatusCode::OK,
        Json(SearchResponse {
            query: query.to_string(),
            normalized_query,
            total_matches,
            limited_to: results.len(),
            cache_hit,
            results,
        }),
    )
        .into_response()
}

async fn reload_handler(
    State(state): State<AppState>,
    Query(params): Query<ReloadQuery>,
) -> impl IntoResponse {
    let requested_source = params.source.as_deref().unwrap_or("local");

    let loaded = match requested_source {
        "local" => load_quran_from_local(&state.data_path)
            .await
            .map(|verses| (verses, format!("local file ({})", state.data_path))),
        "api" => load_quran_from_api(state.fetch_concurrency)
            .await
            .map(|verses| (verses, "Quran Foundation API".to_string())),
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ApiError {
                    error: "invalid source; use source=local or source=api".to_string(),
                }),
            )
                .into_response()
        }
    };

    match loaded {
        Ok((verses, source_label)) => {
            let new_source = SourceState {
                verses: Arc::new(build_index(verses)),
                loaded_at_unix: unix_now(),
                source_label: source_label.clone(),
            };

            {
                let mut source = state.source.write().await;
                *source = new_source;
            }
            {
                let mut cache = state.cache.lock().expect("search cache poisoned");
                cache.clear();
            }

            let source = state.source.read().await;
            (
                StatusCode::OK,
                Json(ReloadResponse {
                    ok: true,
                    source: source.source_label.clone(),
                    verses_loaded: source.verses.len(),
                    loaded_at_unix: source.loaded_at_unix,
                }),
            )
                .into_response()
        }
        Err(err) => (
            StatusCode::BAD_GATEWAY,
            Json(ApiError {
                error: format!("reload failed: {err:#}"),
            }),
        )
            .into_response(),
    }
}

fn env_usize(name: &str, default: usize) -> usize {
    std::env::var(name)
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(default)
}

fn env_bool(name: &str, default: bool) -> bool {
    std::env::var(name)
        .ok()
        .and_then(|v| match v.to_ascii_lowercase().as_str() {
            "1" | "true" | "yes" | "on" => Some(true),
            "0" | "false" | "no" | "off" => Some(false),
            _ => None,
        })
        .unwrap_or(default)
}

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}
