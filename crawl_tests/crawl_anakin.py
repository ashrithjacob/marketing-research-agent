#!/usr/bin/env python3
"""
AnakinScraper (self-hosted) — the Firecrawl-shaped alternative.

Same job as `crawl_firecrawl.py`: url in, page text out. The interesting
differences are that the handler chain falls back HTTP -> Camoufox browser ->
paid API, and that a domain config can declare failure patterns so a bot wall
retries instead of being returned as content.

    make up                       # in ../../anakin — starts server, browser, postgres
    python3 crawl_anakin.py                                  # example url
    python3 crawl_anakin.py https://www.trustpilot.com/review/huel.com --browser
    python3 crawl_anakin.py <url> --json                     # Gemini extraction
    python3 crawl_anakin.py --which-handler <url>            # + proxy scores

`--browser` is the flag that matters for a JS wall: without it the chain starts
on the plain HTTP handler and may return the challenge page as "content".

Cost: free (your own compute), unless ANAKIN_API_KEY routes the tail of the
chain to anakin.io.
"""

from __future__ import annotations

import argparse
import os
import sys
import urllib.error
import urllib.request

from common import Result, env, load_env, post_json, save, timed, wall_check

# --- CHANGE ME -------------------------------------------------------------
EXAMPLE_URL = "https://huel.com/products/huel-daily-greens"
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
    result.note = wall_why or "; ".join(notes)

    suffix = "md" if decoded.get("markdown") else "html"
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
