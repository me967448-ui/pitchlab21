"""Build the bundled PES 2021 player catalogue from PESMASTER's own search API."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import json
import random
import time


BASE = "https://www.pesmaster.com/pes-2021/search/"
API = BASE + "api.php?game=2021&page={}"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
    "Referer": BASE,
    "Accept": "application/json, text/plain, */*",
}
OUT = Path(__file__).parent / "data" / "pesmaster-players.json"
EXPECTED_PER_PAGE = 30


def fetch_page(page: int) -> tuple[int, dict]:
    for attempt in range(6):
        try:
            time.sleep(random.uniform(0.12, 0.32))
            request = Request(API.format(page), headers=HEADERS)
            with urlopen(request, timeout=45) as response:
                payload = json.loads(response.read().decode("utf-8"))
            if not isinstance(payload.get("data"), list) or not payload["data"]:
                raise ValueError(f"Page {page} had no player rows")
            return page, payload
        except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
            if attempt == 5:
                raise RuntimeError(f"Could not fetch PESMASTER player page {page}: {exc}") from exc
            time.sleep(1.5 * (attempt + 1))


def main() -> None:
    first_page, first = fetch_page(1)
    count = int(first["count"])
    pages = (count + EXPECTED_PER_PAGE - 1) // EXPECTED_PER_PAGE
    received = {first_page: first}
    print(f"PESMASTER reports {count:,} records across {pages} search pages.", flush=True)
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(fetch_page, page): page for page in range(2, pages + 1)}
        for completed, future in enumerate(as_completed(futures), start=1):
            page, payload = future.result()
            received[page] = payload
            if completed % 50 == 0 or completed == pages - 1:
                print(f"Fetched {completed + 1}/{pages} pages", flush=True)
    rows = [row for page in range(1, pages + 1) for row in received[page]["data"]]
    if len(rows) != count:
        raise RuntimeError(f"Expected {count} rows, received {len(rows)}")
    ids = [str(row.get("id", "")) for row in rows]
    if any(not value for value in ids):
        raise RuntimeError("PESMASTER search results contained a missing player ID")
    duplicate_ids = count - len(set(ids))
    if duplicate_ids:
        print(f"PESMASTER includes {duplicate_ids:,} repeated profile IDs as separate database entries.", flush=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": "PESMASTER PES 2021 Advanced Search API",
        "sourceUrl": BASE,
        "count": count,
        "generatedAt": time.strftime("%Y-%m-%d", time.gmtime()),
        "fields": "Exact public search-result records; full player profiles load in-site from PESMASTER on demand.",
        "players": rows,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Saved {len(rows):,} exact PESMASTER records to {OUT} ({OUT.stat().st_size:,} bytes).", flush=True)


if __name__ == "__main__":
    main()
