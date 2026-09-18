#!/usr/bin/env python3
"""
Apify spike — answers the four things spec-review-mining.md §5.6 lists as unverified,
for about $0.20, BEFORE any adapter is written:

  1. the real dataset field names for each actor
  2. whether filterByRatings / filterStars actually filter
  3. real yield per product / per brand
  4. whether minimalMaxTotalChargeUsd is also a minimum *charge*

Spend is capped two ways on every call: `maxTotalChargeUsd` as a hard server-side
ceiling, and tiny maxReviews/maxItems. Nothing here runs unbounded.

    export APIFY_TOKEN=apify_api_...
    python3 apify_spike.py            # both actors
    python3 apify_spike.py amazon     # just one

Costs, worst case at the caps below: Amazon 5 reviews x $0.006 = $0.03,
Trustpilot 5 items x $0.00075 + $0.05 start = $0.054. The per-run minimum charge
(if it is one) dominates both — which is exactly question 4.
"""
import json, os, sys, urllib.request, urllib.error
from collections import Counter

TOKEN = os.environ.get("APIFY_TOKEN")
if not TOKEN:
    sys.exit("APIFY_TOKEN not set. See .env.example; spec-review-mining.md §5.6.")

API = "https://api.apify.com/v2"

# (actor, input, hard spend cap in USD, the star field we asked to filter on)
CASES = {
    "amazon": (
        "junglee~amazon-reviews-scraper",
        {
            "productUrls": [{"url": "https://www.amazon.com/dp/B000BD0RT0"}],
            "filterByRatings": ["threeStar"],   # the capability we are paying for
            "maxReviews": 5,
            "sort": "recent",
            "includeGdprSensitive": False,
            "scrapeProductDetails": False,
        },
        0.25,
        3,
    ),
    "trustpilot": (
        "memo23~trustpilot-scraper-ppe",
        {
            "startUrls": [{"url": "https://www.trustpilot.com/review/huel.com"}],
            "filterStars": ["3"],
            "maxItems": 5,
            "sortBy": "recent",
            # painPointAnalysis / reviewInsights deliberately OFF — §5.4
        },
        0.25,
        3,
    ),
}


def run(actor, payload, cap):
    url = (f"{API}/acts/{actor}/run-sync-get-dataset-items"
           f"?token={TOKEN}&maxTotalChargeUsd={cap}")
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return r.status, json.loads(r.read() or "[]")
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")[:400]
        # 402 = out of credit. That is a billing problem wearing a data problem's
        # clothes, and §7.3 says to surface it as such.
        return e.code, {"_http_error": e.code, "_body": body}


def report(name, items, want_star):
    print(f"\n{'='*66}\n{name}")
    if isinstance(items, dict):
        print("  FAILED:", json.dumps(items)[:400]); return
    print(f"  items returned: {len(items)}")
    if not items:
        print("  EMPTY DATASET on a successful run — this is the Apify-shaped")
        print("  'a wall fetches successfully'. Never record it as 'no reviews'.")
        return

    first = items[0]
    print(f"  FIELD NAMES ({len(first)}): {sorted(first)}")

    # locate the fields §2.3 needs, without assuming their names
    def find(*cands):
        return next((k for k in first if k.lower() in cands), None)
    f_star = find("rating", "stars", "star", "reviewrating", "ratingvalue")
    f_text = find("text", "reviewdescription", "body", "reviewtext", "content")
    f_date = find("date", "reviewdate", "publisheddate", "experienceddate")
    print(f"  -> star={f_star!r}  text={f_text!r}  date={f_date!r}")

    if f_star:
        spread = Counter(i.get(f_star) for i in items)
        print(f"  star spread: {dict(spread)}")
        vals = {str(v) for v in spread}
        ok = vals <= {str(want_star), f"{want_star}.0"}
        print(f"  FILTER HONOURED: {ok}"
              + ("" if ok else f"  <-- asked for {want_star}* only; DISCARD (§7.3)"))
    if f_text:
        print(f"  sample text: {str(items[0].get(f_text))[:160]!r}")
    for k in first:
        if "error" in k.lower() and first[k]:
            print(f"  ERROR FIELD {k}={first[k]!r}  (no_relevant_reviews_found = gap, not failure)")


which = sys.argv[1:] or list(CASES)
for name in which:
    if name not in CASES:
        print(f"unknown case {name!r}; pick from {list(CASES)}"); continue
    actor, payload, cap, want = CASES[name]
    print(f"\n>>> {name}: {actor}  (cap ${cap})")
    print(f"    input: {json.dumps(payload)}")
    status, items = run(actor, payload, cap)
    print(f"    http={status}")
    report(name, items, want)

print("\nNow check the actual spend in the Apify console against the arithmetic in")
print("spec-review-mining.md §5.5 — that is question 4, and it is the one that")
print("decides whether a run costs $3.90 or $4.85.")
