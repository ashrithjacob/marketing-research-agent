#!/usr/bin/env python3
"""
Firecrawl — what marketing-research-agent's `web_fetch` uses today.

    python3 crawl_firecrawl.py                              # the example ASIN
    python3 crawl_firecrawl.py https://www.amazon.com/dp/B0C1234567
    python3 crawl_firecrawl.py <amazon url> --as-production  # markdown + main-content
    python3 crawl_firecrawl.py <amazon url> --stealth --wait 6000
    python3 crawl_firecrawl.py https://huel.com/products/x   # any non-Amazon page

**On an amazon.com url this does NOT use production's settings by default**, and
that is deliberate. Production sends `formats: ["markdown"], onlyMainContent:
true`; `onlyMainContent` was measured trimming Amazon's reviews off the page
(spec-stage-1.md §2.5.2 correction (c)), and the data-hooks the extractor needs
only survive in html. So an Amazon target defaults to `--full --html` and the
run says so. `--as-production` reproduces what a stage-1 run really sees, which
is the other half of the comparison and usually worse.

Needs FIRECRAWL_API_KEY (picked up from ../.env).
Cost: a Firecrawl credit per scrape; stealth proxy costs more credits per call.
"""

from __future__ import annotations

import argparse
import sys

from common import (
    Result,
    amazon_reviews,
    env,
    is_amazon,
    load_env,
    need,
    post_json,
    save,
    spread_of,
    timed,
    wall_check,
)

# --- CHANGE ME -------------------------------------------------------------
# A US listing with 500+ written reviews — enough that "zero reviews returned"
# can only ever be the crawler's fault, never the product's.
EXAMPLE_URL = "https://www.amazon.com/dp/B000BD0RT0"
# ---------------------------------------------------------------------------


def fetch(
    url: str,
    *,
    main_content: bool = True,
    fmt: str = "markdown",
    wait_ms: int = 0,
    stealth: bool = False,
    timeout: int = 90,
) -> Result:
    api_key = need("FIRECRAWL_API_KEY", "Firecrawl cannot be called without it")
    base = env("FIRECRAWL_BASE_URL", "https://api.firecrawl.dev").rstrip("/")

    payload: dict = {"url": url, "formats": [fmt], "onlyMainContent": main_content}
    if wait_ms:
        payload["waitFor"] = wait_ms
    if stealth:
        # §3.3 measured this buying page *access* on some ASINs and never
        # buying review access. Worth reproducing before believing otherwise.
        payload["proxy"] = "stealth"

    result = Result(crawler="firecrawl", target=url)
    (status, decoded, raw), elapsed = timed(
        lambda: post_json(
            f"{base}/v2/scrape",
            payload,
            {"Authorization": f"Bearer {api_key}"},
            timeout,
        )
    )
    result.status, result.elapsed_ms = status, elapsed

    if not isinstance(decoded, dict) or status >= 400 or decoded.get("success") is False:
        detail = decoded.get("error") if isinstance(decoded, dict) else raw[:200]
        result.note = f"Firecrawl returned {status}: {detail}"
        # Firecrawl refuses some domains outright ("we do not support this
        # site" — measured on Reddit, spec-stage-1.md:262). That is a policy
        # answer, not a fetch failure, and it is worth seeing as itself.
        return result

    data = decoded.get("data") or {}
    text = data.get(fmt) or data.get("markdown") or data.get("html") or ""
    result.title = (data.get("metadata") or {}).get("title") or ""
    result.chars = len(text)
    result.ok = bool(text.strip())
    result.wall, why = wall_check(text)
    settings = f"onlyMainContent={main_content} format={fmt}" + (" proxy=stealth" if stealth else "")
    result.note = why or settings
    result.raw_path = save("firecrawl", url, "md" if fmt == "markdown" else "html", text)

    if not result.ok:
        result.note = "empty body — web_fetch throws here rather than archiving nothing"
    elif is_amazon(url):
        rows, diagnosis = amazon_reviews(text)
        result.records = len(rows)
        result.star_spread = spread_of(r["star"] for r in rows)
        # A page full of product copy with no reviews on it is not a success
        # for this comparison, whatever the char count says.
        result.ok = bool(rows)
        result.note = f"{settings} — {diagnosis}"
    return result


def main() -> int:
    load_env()
    parser = argparse.ArgumentParser(description="Scrape one url through Firecrawl.")
    parser.add_argument("url", nargs="?", default=EXAMPLE_URL)
    parser.add_argument("--full", action="store_true", help="onlyMainContent: false")
    parser.add_argument("--html", action="store_true", help="ask for html instead of markdown")
    parser.add_argument(
        "--as-production",
        action="store_true",
        help="markdown + onlyMainContent, exactly what web_fetch sends",
    )
    parser.add_argument("--wait", type=int, default=0, metavar="MS", help="waitFor, milliseconds")
    parser.add_argument("--stealth", action="store_true", help="proxy: stealth (more credits)")
    parser.add_argument("--timeout", type=int, default=90)
    args = parser.parse_args()

    # Amazon needs html for the data-hooks and the full page for the review
    # block; anything else defaults to what production sends.
    amazon_defaults = is_amazon(args.url) and not args.as_production
    result = fetch(
        args.url,
        main_content=not (args.full or amazon_defaults),
        fmt="html" if (args.html or amazon_defaults) else "markdown",
        wait_ms=args.wait,
        stealth=args.stealth,
        timeout=args.timeout,
    )
    if amazon_defaults:
        print("amazon url: defaulting to --full --html. Use --as-production for web_fetch's own settings.")
    result.print()
    print(f"\nRead it:  less {result.raw_path}" if result.raw_path else "")
    return 0 if result.ok and not result.wall else 1


if __name__ == "__main__":
    sys.exit(main())
