#!/usr/bin/env python3
"""
Outscraper — the cheap challenger to Apify for Amazon reviews.

Listed price, from outscraper.com/amazon-reviews-scraper: **free for the first
500 reviews**, then $2/1,000 (501–5,000), then $1/1,000. Against Apify's FREE
tier at $0.006/review that is 3x cheaper at the paid rate and 6x at volume —
which is why this is worth measuring rather than assuming.

    python3 crawl_outscraper.py                             # example ASIN, 3-star
    python3 crawl_outscraper.py https://www.amazon.com/dp/B0C1234567 --stars 3
    python3 crawl_outscraper.py <url> --all-stars --limit 20
    python3 crawl_outscraper.py <url> --stars 3 --sort recent --verified-only
    python3 crawl_outscraper.py <url> --check-filter        # the test that matters

**The test that matters is `--check-filter`.** Outscraper's parameter is named
`filterByStar` and takes `three_star` — the same name and the same values as
Amazon's own query parameter, which spec-review-mining.md §3.4 measured LYING in
two directions: `three_star` returns zero, `one_star` returns the unfiltered
sample. If Outscraper passes that parameter through to the page rather than
filtering the results itself, it inherits the lie, and cheap fabricated star
data is worse than expensive honest data. Apify's actor was verified to honour
the band; this asks the same question of this one.

Needs OUTSCRAPER_API_KEY (picked up from ../.env).
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.parse
import urllib.request

from common import Result, load_env, need, save, spread_of, timed

# --- CHANGE ME -------------------------------------------------------------
# The same ASIN the other three scripts default to, so the four are comparable.
EXAMPLE_URL = "https://www.amazon.com/dp/B000BD0RT0"
# ---------------------------------------------------------------------------

# The client tries these in order; the first is the documented one.
API = "https://api.app.outscraper.com"

# Outscraper's own names for the bands — identical to Amazon's, which is the
# reason for --check-filter.
STAR_PARAM = {
    1: "one_star",
    2: "two_star",
    3: "three_star",
    4: "four_star",
    5: "five_star",
}

PRICE_TIERS = [
    (500, 0.0, "first 500 reviews, free"),
    (5000, 0.002, "501-5,000 at $2/1,000"),
    (None, 0.001, "beyond 5,000 at $1/1,000"),
]


def get(path: str, params: dict, timeout: int = 180) -> tuple[int, dict | list]:
    key = need("OUTSCRAPER_API_KEY", "Outscraper cannot be called without it")
    clean = {k: v for k, v in params.items() if v is not None}
    url = f"{API}{path}?{urllib.parse.urlencode(clean, doseq=True)}"
    request = urllib.request.Request(url, headers={"X-API-KEY": key, "client": "crawl_tests"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, json.loads(response.read() or "null")
    except urllib.error.HTTPError as error:
        body = error.read().decode(errors="replace")
        try:
            return error.code, json.loads(body)
        except json.JSONDecodeError:
            return error.code, {"_body": body[:400]}
    except Exception as error:
        return 0, {"_error": f"{type(error).__name__}: {error}"}


def poll(request_id: str, timeout_s: int = 300) -> dict:
    """An async submission returns an id; the result lands on /requests/{id}.

    Status stays `Pending` until it does not — there is no progress to read, so
    this just waits, and a timeout here is a timeout, never "no reviews".
    """
    deadline = time.monotonic() + timeout_s
    transport_fails = 0
    while time.monotonic() < deadline:
        time.sleep(5)
        status, payload = get(f"/requests/{request_id}", {})
        if status == 0:
            # A blip is worth riding out; a run of them is a network problem,
            # and reporting it as "Pending forever" would hide that.
            transport_fails += 1
            if transport_fails >= 5:
                return {"status": "TransportFailure", "data": [], "last": payload}
            continue
        transport_fails = 0
        if isinstance(payload, dict) and payload.get("status") != "Pending":
            return payload
    return {"status": "Timeout", "data": []}


def rows_of(payload) -> list[dict]:
    """Unwrap the reviews. The shape is data -> [ {reviews_data: [...] } ]."""
    data = payload.get("data") if isinstance(payload, dict) else payload
    if not isinstance(data, list):
        return []
    rows: list[dict] = []
    for entry in data:
        if isinstance(entry, dict):
            found = entry.get("reviews_data") or entry.get("reviews") or []
            rows.extend(r for r in found if isinstance(r, dict))
        elif isinstance(entry, list):
            rows.extend(r for r in entry if isinstance(r, dict))
    return rows


def star_of(row: dict):
    """Outscraper's rating field, whatever it calls it on the day."""
    for key in ("review_rating", "rating", "reviewRating", "stars", "score"):
        value = row.get(key)
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            head = value.strip().split()[0] if value.strip() else ""
            try:
                return float(head)
            except ValueError:
                continue
    return None


def text_of(row: dict) -> str:
    for key in ("review_text", "body", "text", "review_body", "content"):
        value = row.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def fetch(
    url: str = EXAMPLE_URL,
    star: int | None = 3,
    limit: int = 10,
    sort: str = "recent",
    verified_only: bool = False,
    domain: str = "amazon.com",
) -> Result:
    params = {
        "query": url,
        "limit": limit,
        "sort": sort,
        "filterByStar": STAR_PARAM[star] if star else "all_stars",
        "filterByReviewer": "avp_only_reviews" if verified_only else "all_reviews",
        "domain": domain,
        "async": "true",
    }
    band = f"{star}*" if star else "all stars"
    result = Result(crawler="outscraper", target=f"{url} [{band}]")

    (status, payload), elapsed = timed(lambda: get("/amazon/reviews", params))
    result.status = status

    # status 0 is OUR side failing — DNS, a dropped connection, a timeout. It is
    # not an answer about the product, and it must never reach the "no reviews"
    # branch below. This bit was wrong on the first write: a run of five bands
    # printed five honest-looking empties that were all name-resolution errors.
    if status == 0:
        result.elapsed_ms = elapsed
        result.note = f"TRANSPORT FAILURE, no answer from Outscraper: {json.dumps(payload)[:220]}"
        return result
    if status == 402 or (isinstance(payload, dict) and "credit" in str(payload).lower()):
        result.elapsed_ms = elapsed
        result.note = f"billing response {status}: {json.dumps(payload)[:220]}"
        return result
    if status >= 400 or not isinstance(payload, (dict, list)):
        result.elapsed_ms = elapsed
        result.note = f"http {status}: {json.dumps(payload)[:260]}"
        return result

    # A submitted task comes back as an id to poll; a sync one comes back whole.
    if isinstance(payload, dict) and payload.get("id") and not payload.get("data"):
        payload = poll(payload["id"])
    result.elapsed_ms = elapsed

    if isinstance(payload, dict) and payload.get("status") in ("Timeout", "TransportFailure"):
        result.note = (
            f"{payload['status']} while polling — NOT an absence of reviews. "
            f"{json.dumps(payload.get('last', ''))[:160]}"
        )
        return result

    rows = [r for r in rows_of(payload) if text_of(r)]
    result.records = len(rows)
    if not rows:
        result.note = (
            "no reviews in a successful response. Check the raw payload before "
            "reading this as 'the product has none'."
        )
        result.raw_path = save("outscraper", url, "json", json.dumps(payload, indent=2)[:400000])
        return result

    result.ok = True
    result.star_spread = spread_of(star_of(r) for r in rows)
    if star is not None:
        result.filter_honoured = set(result.star_spread) <= {star, float(star)}
        if not result.filter_honoured:
            result.note = (
                f"asked for {band} and got {result.star_spread} — the filter is NOT "
                "honoured. These rows carry fabricated star data; discard them."
            )
    body = json.dumps(rows, indent=2)
    result.raw_path = save("outscraper", f"{url}-{band}", "json", body)
    result.chars = len(body)
    result.title = str(rows[0].get("review_title") or rows[0].get("title") or "")[:80]
    return result


def check_filter(url: str, limit: int) -> int:
    """Ask for each band in turn and see whether the band is what comes back.

    This is the §3.4 trap, re-run against a different vendor: Amazon's own
    `filterByStar` returns zero for three_star and the UNFILTERED sample for
    one_star. A wrapper that forwards the parameter inherits both, and the
    second failure is the dangerous one — it looks like data.
    """
    print(f"filter check on {url}, {limit} per band\n")
    print(f"  {'asked':<10} {'got':<6} {'spread':<34} verdict")
    verdicts = []
    for star in (1, 2, 3, 4, 5):
        result = fetch(url, star, limit)
        spread = result.star_spread or {}
        if "TRANSPORT FAILURE" in result.note or "TransportFailure" in result.note:
            verdict = "NO ANSWER — network, not data"
        elif not result.records:
            verdict = "EMPTY — cannot tell"
        elif result.filter_honoured:
            verdict = "honoured"
        else:
            verdict = "LIES — discard"
        verdicts.append((star, result.records, verdict))
        print(f"  {str(star) + '-star':<10} {str(result.records or 0):<6} {str(spread):<34} {verdict}")

    honoured = sum(1 for _, _, v in verdicts if v == "honoured")
    print(f"\n{honoured}/5 bands honoured.")
    if honoured < 5:
        print(
            "A band that returns the wrong spread is worse than one that returns\n"
            "nothing: fabricated star data reads like evidence. See\n"
            "../spec-review-mining.md §3.4 for the same failure on Amazon's own page."
        )
    return 0 if honoured == 5 else 1


def main() -> int:
    load_env()
    parser = argparse.ArgumentParser(description="Amazon reviews through Outscraper.")
    parser.add_argument("url", nargs="?", default=EXAMPLE_URL)
    parser.add_argument("--stars", type=int, default=3, choices=[1, 2, 3, 4, 5])
    parser.add_argument("--all-stars", action="store_true")
    parser.add_argument("--limit", type=int, default=10, help="reviews per query")
    parser.add_argument("--sort", default="recent", choices=["recent", "helpful"])
    parser.add_argument("--verified-only", action="store_true", help="avp_only_reviews")
    parser.add_argument("--domain", default="amazon.com")
    parser.add_argument("--check-filter", action="store_true", help="test all five bands")
    args = parser.parse_args()

    print("price: free for the first 500 reviews, then $2/1,000, then $1/1,000")
    print("       (listed; Outscraper's dashboard is the authority on your usage)\n")

    if args.check_filter:
        return check_filter(args.url, args.limit)

    result = fetch(
        args.url,
        None if args.all_stars else args.stars,
        args.limit,
        args.sort,
        args.verified_only,
        args.domain,
    )
    result.print()
    if result.raw_path:
        print(f"\nRead it:  jq . {result.raw_path} | less")
    return 0 if result.ok else 1


if __name__ == "__main__":
    sys.exit(main())
