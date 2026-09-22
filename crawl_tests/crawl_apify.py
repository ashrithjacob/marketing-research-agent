#!/usr/bin/env python3
"""
Apify — the route marketing-research-agent actually buys for review mining.

Three actors, all reachable from this one script:

    amazon      junglee/amazon-reviews-scraper        reviews for ONE product url
    search      junglee/free-amazon-product-scraper   product name -> asin + url
    trustpilot  memo23/trustpilot-scraper-ppe         reviews for ONE company

**This script spends real money.** Every call is capped server-side by
`maxTotalChargeUsd`, and it prints the cap before calling. It refuses to run
without --yes when the sized cap exceeds --budget.

    python3 crawl_apify.py search "magnesium glycinate"      # ~$0.06, find an ASIN
    python3 crawl_apify.py amazon                            # example ASIN, 3-star
    python3 crawl_apify.py amazon https://www.amazon.com/dp/B000BD0RT0 --stars 3 --max 5
    python3 crawl_apify.py trustpilot huel.com --stars 3 --max 5

Needs APIFY_TOKEN (picked up from ../.env).
"""

from __future__ import annotations

import argparse
import json
import sys

from common import HERE, Result, load_env, need, post_json, save, spread_of, timed

# --- CHANGE ME -------------------------------------------------------------
# A real magnesium listing with enough written reviews to be worth mining.
EXAMPLE_AMAZON_URL = "https://www.amazon.com/dp/B000BD0RT0"
EXAMPLE_TRUSTPILOT = "huel.com"
EXAMPLE_QUERY = "magnesium glycinate"
# ---------------------------------------------------------------------------

API = "https://api.apify.com/v2"

AMAZON_REVIEWS = "junglee~amazon-reviews-scraper"
AMAZON_SEARCH = "junglee~free-amazon-product-scraper"
TRUSTPILOT = "memo23~trustpilot-scraper-ppe"

# Apify rejects a cap BELOW the actor's own minimum with a 400 at call time.
# These are floors, not budgets — measured 2026-09-17.
MIN_CAP_USD = {AMAZON_REVIEWS: 0.50, TRUSTPILOT: 0.45, AMAZON_SEARCH: 0.005}
UNIT_PRICE_USD = {AMAZON_REVIEWS: 0.006, TRUSTPILOT: 0.00075, AMAZON_SEARCH: 0.012}
START_FEE_USD = {TRUSTPILOT: 0.05}

# The actor's names for the star bands. Never `positive`/`critical`: those
# aggregates overlap, and an overlapped spread cannot be checked against what
# was asked for.
STAR_BAND = {1: "oneStar", 2: "twoStar", 3: "threeStar", 4: "fourStar", 5: "fiveStar"}


def cap_for(actor: str, items: int) -> float:
    """Size the cap from the volume asked for, with 2x headroom, floored.

    The actor's stated minimum is NOT a sufficient cap: the search actor accepts
    its own $0.005 minimum and then dies with "Charge limit has already been
    reached", returning an EMPTY DATASET that reads exactly like "no products
    matched". That is the single most expensive misreading available here.
    """
    start = START_FEE_USD.get(actor, 0.0)
    need_usd = start + max(items, 1) * UNIT_PRICE_USD[actor] * 2
    return round(max(MIN_CAP_USD[actor], need_usd), 4)


def call(actor: str, payload: dict, cap: float, timeout: int = 300):
    token = need("APIFY_TOKEN", "Apify cannot be called without it")
    url = f"{API}/acts/{actor}/run-sync-get-dataset-items?token={token}&maxTotalChargeUsd={cap}"
    return post_json(url, payload, {}, timeout)


def _finish(result: Result, status: int, items, cap: float, want_star: int | None) -> Result:
    result.status = status
    result.cost_usd = cap
    result.cost_is_cap = True  # a ceiling; the Apify console is the authority

    if status == 402:
        result.note = (
            "HTTP 402 — the Apify account is out of credit. A billing limit, "
            "NOT an absence of reviews. Never record this as a gap."
        )
        return result
    if not isinstance(items, list):
        result.note = f"http {status}: {json.dumps(items)[:300]}"
        return result

    result.records = len(items)
    if not items:
        result.note = (
            "EMPTY DATASET on a finished run — the Apify-shaped 'a wall fetches "
            "successfully'. Do not read it as 'no reviews'; check the run in the "
            "Apify console, and check the cap was big enough."
        )
        return result

    first = items[0]
    if isinstance(first, dict) and first.get("error"):
        ratings = first.get("totalCategoryRatings")
        result.ok = True  # the call worked; the answer is a gap
        result.note = (
            f"actor reported {first['error']}"
            + (f" ({ratings} ratings exist, none written at this band)" if ratings else "")
            + " — an honest GAP, and still billed"
        )
        return result

    result.ok = True
    return result


def amazon_reviews(
    url: str = EXAMPLE_AMAZON_URL,
    star: int | None = 3,
    max_reviews: int = 5,
    sort: str = "recent",
) -> Result:
    payload = {
        "productUrls": [{"url": url}],
        "filterByRatings": [STAR_BAND[star] if star else "allStars"],
        "maxReviews": max_reviews,
        "sort": sort,
        # Reviewer names and profile ids are personal data and nothing
        # downstream needs them: text, star and date carry the whole excerpt.
        "includeGdprSensitive": False,
        "scrapeProductDetails": False,
    }
    cap = cap_for(AMAZON_REVIEWS, max_reviews)
    result = Result(crawler="apify/amazon", target=f"{url} [{star or 'all'}*]")
    (status, items, _), elapsed = timed(lambda: call(AMAZON_REVIEWS, payload, cap))
    result.elapsed_ms = elapsed
    _finish(result, status, items, cap, star)

    if result.records:
        rows = [i for i in items if isinstance(i, dict) and str(i.get("reviewDescription", "")).strip()]
        # Measured field names, NOT the ones in the actor's README: it is
        # reviewDescription (not text) and ratingScore (not rating). A reader
        # written from the docs returns None for every excerpt.
        result.star_spread = spread_of(i.get("ratingScore") for i in rows)
        if star is not None and rows:
            result.filter_honoured = set(result.star_spread) <= {star, float(star)}
            if not result.filter_honoured:
                result.note = (
                    f"asked for {star}* and other ratings came back — DISCARD these rows, "
                    "the star data is not trustworthy"
                )
        if rows:
            body = json.dumps(rows, indent=2)
            result.raw_path = save("apify-amazon", url, "json", body)
            result.chars = len(body)
            result.title = str(rows[0].get("reviewTitle", ""))[:80]
    return result


def amazon_search(query: str = EXAMPLE_QUERY, max_results: int = 5, host: str = "www.amazon.com") -> Result:
    search_url = f"https://{host}/s?k={query.replace(' ', '+')}"
    payload = {
        "categoryUrls": [{"url": search_url}],
        "maxItemsPerStartUrl": max_results,
        "maxSearchPagesPerStartUrl": 1,
        "scrapeProductDetails": False,
    }
    cap = cap_for(AMAZON_SEARCH, max_results)
    result = Result(crawler="apify/search", target=query)
    (status, items, _), elapsed = timed(lambda: call(AMAZON_SEARCH, payload, cap))
    result.elapsed_ms = elapsed
    _finish(result, status, items, cap, None)

    if result.records:
        products = [i for i in items if isinstance(i, dict) and i.get("asin")]
        # Most-reviewed first: pick the product with the most customer language,
        # not the one Amazon happened to rank first.
        products.sort(key=lambda p: p.get("reviewsCount") or 0, reverse=True)
        body = json.dumps(products, indent=2)
        result.raw_path = save("apify-search", query, "json", body)
        result.chars = len(body)
        print("\n  asin        stars  reviews  title")
        for product in products:
            # The actor returns `url` empty; construct it from the asin.
            url = product.get("url") or f"https://{host}/dp/{product['asin']}"
            print(
                f"  {product['asin']:<11} {str(product.get('stars', '?')):<6} "
                f"{str(product.get('reviewsCount', '?')):<8} {str(product.get('title', ''))[:52]}"
            )
            print(f"              -> {url}")
    return result


def trustpilot_reviews(domain: str = EXAMPLE_TRUSTPILOT, star: int | None = 3, max_items: int = 5) -> Result:
    payload = {
        "startUrls": [{"url": domain}],
        "filterStars": [] if star is None else [str(star)],
        "maxItems": max_items,
        "sortBy": "recent",
        "filterLanguages": ["en"],
        # painPointAnalysis / reviewInsights stay OFF: LLM paraphrase at up to
        # 67x the per-item rate, and paraphrase is forbidden in an excerpt.
        "includeCompanyDetails": False,
    }
    cap = cap_for(TRUSTPILOT, max_items)
    result = Result(crawler="apify/trustpilot", target=f"{domain} [{star or 'all'}*]")
    (status, items, _), elapsed = timed(lambda: call(TRUSTPILOT, payload, cap))
    result.elapsed_ms = elapsed
    _finish(result, status, items, cap, star)

    if result.records:
        rows = [i for i in items if isinstance(i, dict) and str(i.get("text", "")).strip()]
        result.star_spread = spread_of(i.get("rating") for i in rows)
        if star is not None and rows:
            result.filter_honoured = set(result.star_spread) <= {star, float(star)}
        if rows:
            body = json.dumps(rows, indent=2)
            result.raw_path = save("apify-trustpilot", domain, "json", body)
            result.chars = len(body)
            result.title = str(rows[0].get("title", ""))[:80]
    return result


# --- volume: how to actually reach hundreds of reviews ---------------------


def balance() -> tuple[float, float]:
    """(spent, cap) this billing cycle, straight from Apify. Costs nothing.

    Worth checking before a volume run rather than after: the FREE plan's cap is
    a hard stop, and a job that dies halfway has still spent the money.
    """
    token = need("APIFY_TOKEN", "Apify cannot be called without it")
    import urllib.request

    def get(path: str) -> dict:
        with urllib.request.urlopen(f"{API}/{path}?token={token}", timeout=20) as response:
            return json.loads(response.read())["data"]

    spent = get("users/me/usage/monthly").get("totalUsageCreditsUsdAfterVolumeDiscount") or 0.0
    cap = get("users/me/limits")["limits"].get("maxMonthlyUsageUsd") or 0.0
    return float(spent), float(cap)


# The FREE plan is throttled by the actor itself: "as a free user, you are
# limited to only 1 start URL and you'll get only 10 Amazon reviews per run".
FREE_REVIEWS_PER_RUN = 10

# The actor's own ceiling, from its input schema: "max amount of reviews per
# product is 100 per star count". Five bands, so 500 per product is the most
# any amount of money buys from one listing.
MAX_PER_BAND = 100
BANDS = [3, 1, 2, 4, 5]  # 3-star first: the band the contract actually requires


def plan_runs(target: int, per_run: int, stars: int | None) -> list[tuple[int, str, int]]:
    """(star, sort, n) for each run needed to reach `target` distinct reviews.

    Repeating one query does NOT page — identical input returns the identical
    rows and bills you again for them. The only axes that yield new reviews are
    the star band, the sort order, and keyword search. So a volume job walks
    those instead of looping, and dedupes what comes back.

    **The sort axis is much weaker than the band axis.** Measured 2026-09-22,
    100 asked for across both: the five `recent` runs yielded 50 distinct with
    no overlap at all, and the five `helpful` runs added only 26 more for the
    same $0.30, because "most helpful" and "most recent" draw on one pool.
    Bands first is therefore not cosmetic ordering — it is the whole of the
    cheap yield, and a caller who only needs breadth should stop after them.
    """
    bands = [stars] if stars else BANDS
    runs, planned = [], 0
    for sort in ("recent", "helpful"):
        for band in bands:
            if planned >= target:
                break
            n = min(per_run, MAX_PER_BAND, target - planned)
            runs.append((band, sort, n))
            planned += n
    return runs


def volume(url: str, target: int, stars: int | None, per_run: int, dry_run: bool) -> int:
    runs = plan_runs(target, per_run, stars)
    reachable = sum(n for _, _, n in runs)
    projected = reachable * UNIT_PRICE_USD[AMAZON_REVIEWS]
    spent, cap = balance()
    left = cap - spent

    print(f"target:     {target} distinct reviews from {url}")
    print(f"runs:       {len(runs)} (the actor gives {per_run}/run on this plan)")
    print(f"projected:  ${projected:.3f} at ${UNIT_PRICE_USD[AMAZON_REVIEWS]}/review")
    print(f"balance:    ${spent:.3f} spent of ${cap:.2f} this cycle — ${left:.3f} left")

    # Repeating a query does not page, so the reachable total is bounded by the
    # number of distinct (band, sort) combinations — not by how much you spend.
    if reachable < target:
        bands = 1 if stars else len(BANDS)
        print(
            f"\nCEILING: {reachable} is the most this plan can reach, not {target}.\n"
            f"  {bands} band(s) x 2 sort orders x {per_run}/run = {reachable}.\n"
            + (
                "  Drop --stars to walk all five bands (5 x 2 x "
                f"{per_run} = {len(BANDS) * 2 * per_run}).\n"
                if stars
                else ""
            )
            + f"  Past that, a run of the same query returns the same rows and bills again.\n"
            f"  More than {len(BANDS) * 2 * per_run} needs a plan whose per-run cap is above "
            f"{per_run} — the actor itself allows {MAX_PER_BAND} per band."
        )
    print("\n  #   band   sort      ask")
    for index, (band, sort, n) in enumerate(runs, 1):
        print(f"  {index:<3} {band}*     {sort:<9} {n}")

    if projected > left:
        print(f"\nREFUSED: ${projected:.3f} projected against ${left:.3f} remaining.")
        print("Lower --target, or pay: the cap resets at the end of the cycle.")
        return 1
    if dry_run:
        print("\n--plan only. Nothing was spent. Drop --plan to run it.")
        return 0

    seen: dict[str, dict] = {}
    charged = 0.0
    for index, (band, sort, n) in enumerate(runs, 1):
        result = amazon_reviews(url, band, n, sort=sort)
        rows = json.load(open(HERE / result.raw_path)) if result.raw_path else []
        new = {r.get("reviewId") or r.get("reviewUrl") or str(i): r for i, r in enumerate(rows)}
        before = len(seen)
        seen.update({k: v for k, v in new.items() if k not in seen})
        # Billed per result RETURNED, not per result asked for — and an error
        # record is a billed result, so a gap still costs $0.006.
        charged += max(len(rows), 1) * UNIT_PRICE_USD[AMAZON_REVIEWS]
        print(
            f"  {index:<3} {band}* {sort:<9} got {len(rows):<3} "
            f"new {len(seen) - before:<3} total {len(seen):<4} ~${charged:.3f}"
        )
        if len(seen) >= target:
            break

    rows = list(seen.values())
    path = save("apify-volume", url, "json", json.dumps(rows, indent=2))
    print(f"\n{len(rows)} distinct reviews, spread {spread_of(r.get('ratingScore') for r in rows)}")
    print(f"~${charged:.3f} charged (the Apify console is the authority)")
    print(f"Read it:  jq . {path} | less")
    return 0


def main() -> int:
    load_env()
    parser = argparse.ArgumentParser(description="Run one Apify actor. Spends money.")
    parser.add_argument("case", choices=["amazon", "search", "trustpilot"])
    parser.add_argument("target", nargs="?", default="", help="product url / query / domain")
    parser.add_argument("--stars", type=int, default=3, choices=[1, 2, 3, 4, 5])
    parser.add_argument("--all-stars", action="store_true", help="no star filter")
    parser.add_argument("--max", type=int, default=5, dest="max_items")
    parser.add_argument("--count", type=int, default=0, metavar="N",
                        help="collect N distinct reviews across bands and sorts")
    parser.add_argument("--per-run", type=int, default=FREE_REVIEWS_PER_RUN,
                        help=f"reviews the actor gives per run (FREE plan: {FREE_REVIEWS_PER_RUN})")
    parser.add_argument("--plan", action="store_true",
                        help="print the run plan, the projected cost and the balance; spend nothing")
    parser.add_argument("--budget", type=float, default=1.0, help="refuse a cap above this")
    parser.add_argument("--yes", action="store_true", help="skip the spend confirmation")
    args = parser.parse_args()

    star = None if args.all_stars else args.stars

    if args.count:
        if args.case != "amazon":
            sys.exit("--count is for the amazon case only")
        return volume(args.target or EXAMPLE_AMAZON_URL, args.count, star, args.per_run, args.plan)
    actor = {"amazon": AMAZON_REVIEWS, "search": AMAZON_SEARCH, "trustpilot": TRUSTPILOT}[args.case]
    cap = cap_for(actor, args.max_items)

    print(f"actor:  {actor}")
    print(f"cap:    ${cap}  (floor ${MIN_CAP_USD[actor]}, ~${UNIT_PRICE_USD[actor]}/item)")
    print("        This is a CEILING, not a prediction. The authority on what a run")
    print("        cost is the Apify console; a run returning one error record cost $0.006.")
    if cap > args.budget and not args.yes:
        sys.exit(f"\ncap ${cap} exceeds --budget ${args.budget}. Re-run with --yes to proceed.")

    if args.case == "amazon":
        result = amazon_reviews(args.target or EXAMPLE_AMAZON_URL, star, args.max_items)
    elif args.case == "search":
        result = amazon_search(args.target or EXAMPLE_QUERY, args.max_items)
    else:
        result = trustpilot_reviews(args.target or EXAMPLE_TRUSTPILOT, star, args.max_items)

    result.print()
    if result.raw_path:
        print(f"\nRead it:  jq . {result.raw_path} | less")
    print("\nCheck the real charge in the Apify console — the cap above is not it.")
    return 0 if result.ok else 1


if __name__ == "__main__":
    sys.exit(main())
