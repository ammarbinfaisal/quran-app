#!/usr/bin/env python3
"""Fetch full Quran Arabic text from Quran Foundation API and store locally."""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

API_BASE = "https://api.quran.com/api/v4"
TOTAL_PAGES = 604


def fetch_page(page: int, timeout: float, retries: int, backoff: float) -> List[dict]:
    params = urlencode({
        "language": "ar",
        "fields": "text_uthmani",
        "per_page": 50,
    })
    url = f"{API_BASE}/verses/by_page/{page}?{params}"
    headers = {
        "Accept": "application/json",
        "User-Agent": "quran-search-api-fetcher/0.1",
    }

    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            req = Request(url=url, headers=headers)
            with urlopen(req, timeout=timeout) as response:
                payload = json.load(response)
                return payload.get("verses", [])
        except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError) as err:
            last_err = err
            if attempt == retries:
                break
            time.sleep(backoff * (2 ** (attempt - 1)))

    raise RuntimeError(f"failed to fetch page {page}: {last_err}")


def parse_verse_key(verse_key: str) -> Tuple[int, int]:
    surah_s, ayah_s = verse_key.split(":", 1)
    return int(surah_s), int(ayah_s)


def build_dataset(workers: int, timeout: float, retries: int, backoff: float) -> Dict:
    verses_by_key: Dict[str, dict] = {}

    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, workers)) as executor:
        future_by_page = {
            executor.submit(fetch_page, page, timeout, retries, backoff): page
            for page in range(1, TOTAL_PAGES + 1)
        }

        completed = 0
        for future in concurrent.futures.as_completed(future_by_page):
            page = future_by_page[future]
            rows = future.result()
            completed += 1
            if completed % 25 == 0 or completed == TOTAL_PAGES:
                print(f"Fetched {completed}/{TOTAL_PAGES} pages", file=sys.stderr)

            for row in rows:
                verse_key = row.get("verse_key", "").strip()
                text_uthmani = (row.get("text_uthmani") or row.get("text_imlaei") or "").strip()
                if not verse_key or not text_uthmani:
                    continue

                surah, ayah = parse_verse_key(verse_key)
                verses_by_key.setdefault(
                    verse_key,
                    {
                        "verse_key": verse_key,
                        "surah": surah,
                        "ayah": ayah,
                        "text_uthmani": text_uthmani,
                    },
                )

    verses = sorted(verses_by_key.values(), key=lambda v: (v["surah"], v["ayah"]))

    return {
        "meta": {
            "source": f"{API_BASE}/verses/by_page",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_pages": TOTAL_PAGES,
            "total_verses": len(verses),
        },
        "verses": verses,
    }


def main() -> int:
    default_output = Path(__file__).resolve().parents[1] / "data" / "quran-uthmani.json"

    parser = argparse.ArgumentParser(description="Fetch full Quran Arabic text into local JSON")
    parser.add_argument("--output", type=Path, default=default_output)
    parser.add_argument("--workers", type=int, default=16)
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument("--retries", type=int, default=4)
    parser.add_argument("--backoff", type=float, default=0.5)
    args = parser.parse_args()

    dataset = build_dataset(
        workers=args.workers,
        timeout=args.timeout,
        retries=args.retries,
        backoff=args.backoff,
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(dataset, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    print(f"Wrote {dataset['meta']['total_verses']} verses to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
