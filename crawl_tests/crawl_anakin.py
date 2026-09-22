#!/usr/bin/env python3
"""
AnakinScraper (self-hosted) — the Firecrawl-shaped alternative.

Same job as `crawl_firecrawl.py`: url in, page text out, Amazon reviews counted
out of it. The differences that might matter on Amazon are that the handler
chain falls back HTTP -> Camoufox browser -> paid API, that the browser is
anti-detect Firefox rather than headless Chrome, and that it waits for
`networkidle` — which is the only thing in this folder with a chance of picking
up a review block that loads after first paint.

    make up                       # in ../../anakin — starts server, browser, postgres
    python3 crawl_anakin.py                                  # the example ASIN
    python3 crawl_anakin.py https://www.amazon.com/dp/B0C1234567 --browser
    python3 crawl_anakin.py <url> --browser --fresh          # no cache, real fetch
    python3 crawl_anakin.py <url> --which-handler            # + proxy scores

**Use `--browser` on Amazon.** Without it the chain starts on the plain HTTP
handler, which cannot run the JavaScript the review block needs, and you are
measuring the same single-shot fetch Firecrawl already did.

Cost: free (your own compute), unless ANAKIN_API_KEY routes the tail of the
chain to anakin.io.
"""

from __future__ import annotations

import argparse
import os
import sys
import urllib.error
import urllib.request

from common import (
    Result,
    amazon_reviews,
    env,
    is_amazon,
    load_env,
    post_json,
    save,
    spread_of,
    timed,
    wall_check,
)

# --- CHANGE ME -------------------------------------------------------------
# The same ASIN crawl_firecrawl.py and crawl_apify.py default to, so the three
# are comparable without you having to remember to change three files.
EXAMPLE_URL = "https://www.amazon.com/dp/B000BD0RT0"
# ---------------------------------------------------------------------------

DEFAULT_BASE = "http://localhost:8080"


def base_url() -> str:
    return env("ANAKIN_BASE_URL", DEFAULT_BASE).rstrip("/")


def headers() -> dict:
    key = env("ANAKIN_LOCAL_API_KEY") or env("API_KEY")
    return {"X-API-Key": key} if key else {}


def alive() -> tuple[bool, str]:
    """A refused connection here is the commonest failure — name it clearly."""
    try:
        with urllib.request.urlopen(f"{base_url()}/health", timeout=5) as response:
            return response.status == 200, f"health {response.status}"
    except Exception as error:
        return False, (
            f"{type(error).__name__} talking to {base_url()} — is anakin running? "
            "cd ../../anakin && make up   (or: cd server && go run cmd/server/main.go)"
        )


def fetch(
    url: str,
    *,
    use_browser: bool = False,
    generate_json: bool = False,
    country: str = "",
    fresh: bool = False,
    timeout: int = 90,
) -> Result:
    result = Result(crawler="anakin", target=url, cost_usd=0.0)

    up, why = alive()
    if not up:
        result.note = why
        return result

    payload: dict = {"url": url, "timeout": min(timeout, 120)}
    if use_browser:
        payload["useBrowser"] = True
    if generate_json:
        payload["generateJson"] = True
    if country:
        payload["country"] = country
    if fresh:
        payload["forceFresh"] = True

    (status, decoded, raw), elapsed = timed(
        lambda: post_json(f"{base_url()}/v1/scrape", payload, headers(), timeout + 15)
    )
    result.status, result.elapsed_ms = status, elapsed

    if not isinstance(decoded, dict) or status >= 400:
        detail = decoded.get("message") or decoded.get("error") if isinstance(decoded, dict) else raw[:200]
        result.note = f"anakin returned {status}: {detail}"
        return result

    if decoded.get("error"):
        result.note = f"job {decoded.get('status')}: {decoded['error']}"
        return result

    # For Amazon the raw html is what carries the data-hooks; markdown has
    # already thrown them away, so prefer html and fall back the other way.
    if is_amazon(url):
        text = decoded.get("html") or decoded.get("cleanedHtml") or decoded.get("markdown") or ""
    else:
        text = decoded.get("markdown") or decoded.get("cleanedHtml") or decoded.get("html") or ""
    result.chars = len(text)
    result.ok = bool(text.strip())
    result.wall, wall_why = wall_check(text)

    notes = [f"handler chain {'browser-first' if use_browser else 'http-first'}"]
    if decoded.get("cached"):
        notes.append("CACHED — pass --fresh for a real fetch")
    if decoded.get("durationMs"):
        notes.append(f"server-side {decoded['durationMs']}ms")
    generated = decoded.get("generatedJson")
    if generated:
        notes.append(f"generateJson: {generated.get('status')}")
        if generated.get("data"):
            result.raw_path = save("anakin-json", url, "json", str(generated["data"]))
    if is_amazon(url) and result.ok:
        rows, diagnosis = amazon_reviews(text)
        result.records = len(rows)
        result.star_spread = spread_of(r["star"] for r in rows)
        result.ok = bool(rows)
        notes.append(diagnosis)
        if not rows and not use_browser:
            notes.append("try --browser: the HTTP handler cannot run the review block's JS")
    result.note = wall_why or "; ".join(notes)

    suffix = "html" if is_amazon(url) or not decoded.get("markdown") else "md"
    result.raw_path = save("anakin", url, suffix, text) or result.raw_path
    return result


def show_proxy_scores() -> None:
    """Which proxy Thompson Sampling picked, and how it scored.

    Note this only ever reflects the HTTP handler: anakin's browser handler
    takes no per-request proxy (server/internal/handler/browser.go has no
    ProxyURL reference), so a browser-handled fetch is unproxied whatever the
    pool says.
    """
    try:
        request = urllib.request.Request(f"{base_url()}/v1/proxy/scores", headers=headers())
        with urllib.request.urlopen(request, timeout=10) as response:
            print("\nproxy scores (HTTP handler only):")
            print(response.read().decode(errors="replace")[:1200])
    except Exception as error:
        print(f"\nproxy scores unavailable: {type(error).__name__}: {error}")


def main() -> int:
    load_env()
    parser = argparse.ArgumentParser(description="Scrape one url through a self-hosted anakin.")
    parser.add_argument("url", nargs="?", default=EXAMPLE_URL)
    parser.add_argument("--browser", action="store_true", help="skip the HTTP handler, use Camoufox")
    parser.add_argument("--json", action="store_true", help="generateJson (needs GEMINI_API_KEY)")
    parser.add_argument("--country", default="", help="only forwarded to the external API handler")
    parser.add_argument("--fresh", action="store_true", help="forceFresh — bypass the cache")
    parser.add_argument("--timeout", type=int, default=90, help="sync scrape timeout, max 120")
    parser.add_argument("--which-handler", action="store_true", help="also print proxy scores")
    args = parser.parse_args()

    result = fetch(
        args.url,
        use_browser=args.browser,
        generate_json=args.json,
        country=args.country,
        fresh=args.fresh,
        timeout=args.timeout,
    )
    result.print()
    if args.which_handler:
        show_proxy_scores()
    if result.raw_path:
        print(f"\nRead it:  less {result.raw_path}")
    return 0 if result.ok and not result.wall else 1


if __name__ == "__main__":
    sys.exit(main())
