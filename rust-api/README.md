# Quran Search API (Rust)

A standalone Rust API that:
- Loads Quran Arabic text from a local JSON dataset (`data/quran-uthmani.json`)
- Normalizes Arabic text for tolerant matching
- Uses `needle` Boyer-Moore search to find matching ayat
- Keeps data in warm memory and caches repeated queries

## Data Bootstrap (Python)

Fetch all Quran pages once and save locally:

```bash
cd rust-api
python3 scripts/fetch_quran_text.py
```

This writes:
- `data/quran-uthmani.json` (6236 verses)

## Endpoints

- `GET /health`
- `GET /search?q=<arabic>&limit=50`
- `POST /reload?source=local`
- `POST /reload?source=api`

## Example

```bash
curl 'http://localhost:8080/search?q=الحمد%20لله'
```

Response includes `verse_key`, `surah`, `ayah`, and original `text_uthmani`.

## Run

```bash
cd rust-api
cargo run
```

## Config

- `PORT` (default: `8080`)
- `QURAN_DATA_PATH` (default: `data/quran-uthmani.json`)
- `QURAN_FETCH_CONCURRENCY` (default: `16`, used for API reload/fallback)
- `QURAN_ALLOW_API_FALLBACK` (default: `false`)
- `SEARCH_CACHE_CAPACITY` (default: `512`)

## Notes

- Startup is local-first. If the local file is missing and fallback is disabled, startup fails with an instruction to run the Python fetch script.
- Search query normalization strips harakat and Quranic marks, normalizes alef forms, and normalizes ya/hamza variants.
- Query cache is in-memory LRU keyed by normalized query.
