#!/usr/bin/env python3
"""
Firecrawl — what marketing-research-agent's `web_fetch` uses today.

The defaults here mirror `../server/src/tools.ts:firecrawlScrape` exactly
(`formats: ["markdown"], onlyMainContent: true`), so what this prints is what a
stage-1 run would actually have seen. Change the flags to explore; change the
defaults and you are no longer measuring production.

    python3 crawl_firecrawl.py                                   # example url
    python3 crawl_firecrawl.py https://huel.com/products/daily-greens
    python3 crawl_firecrawl.py <url> --stealth --wait 6000
    python3 crawl_firecrawl.py <url> --full --html

Needs FIRECRAWL_API_KEY (picked up from ../.env).
Cost: a Firecrawl credit per scrape; stealth proxy costs more credits per call.
"""

from __future__ import annotations

import argparse
import sys

from common import Result, env, load_env, need, post_json, save, timed, wall_check

# --- CHANGE ME -------------------------------------------------------------
# A brand's own product page: the bread-and-butter stage-1 fetch, and a page
# nobody blocks. Swap in a Trustpilot or Amazon url to watch it hit a wall.
EXAMPLE_URL = "https://huel.com/products/huel-daily-greens"
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
    result.note = why or f"onlyMainContent={main_content} format={fmt}" + (" proxy=stealth" if stealth else "")
    result.raw_path = save("firecrawl", url, "md" if fmt == "markdown" else "html", text)
    if not result.ok:
        result.note = "empty body — web_fetch throws here rather than archiving nothing"
    return result


def main() -> int:
    load_env()
    parser = argparse.ArgumentParser(description="Scrape one url through Firecrawl.")
    parser.add_argument("url", nargs="?", default=EXAMPLE_URL)
    parser.add_argument("--full", action="store_true", help="onlyMainContent: false")
    parser.add_argument("--html", action="store_true", help="ask for html instead of markdown")
    parser.add_argument("--wait", type=int, default=0, metavar="MS", help="waitFor, milliseconds")
    parser.add_argument("--stealth", action="store_true", help="proxy: stealth (more credits)")
    parser.add_argument("--timeout", type=int, default=90)
    args = parser.parse_args()

    result = fetch(
        args.url,
        main_content=not args.full,
        fmt="html" if args.html else "markdown",
        wait_ms=args.wait,
        stealth=args.stealth,
        timeout=args.timeout,
    )
    result.print()
    print(f"\nRead it:  less {result.raw_path}" if result.raw_path else "")
    return 0 if result.ok and not result.wall else 1


if __name__ == "__main__":
    sys.exit(main())
