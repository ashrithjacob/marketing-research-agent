#!/usr/bin/env python3
"""
Trustpilot, direct — real Chrome, no vendor, no cost.

Trustpilot's 403 is an AWS WAF *JavaScript challenge* being served, not access
being refused: a residential address and a datacentre address get byte-identical
991-byte refusals, and any client that runs JS gets through from either. So the
whole trick is a browser, and then reading `__NEXT_DATA__` rather than scraping
the DOM.

The reason this script is in the comparison at all: `?stars=N` and `?page=M` are
plain query parameters, they compose, and they are HONEST — 20 reviews of the
band you asked for. Contrast Amazon, where the same-shaped parameter lies in two
directions (see README).

    python3 crawl_trustpilot.py                        # example company, 3-star
    python3 crawl_trustpilot.py huel.com --stars 3
    python3 crawl_trustpilot.py https://www.trustpilot.com/review/huel.com --page 2
    python3 crawl_trustpilot.py huel.com --all-bands   # 1..5, the whole spread

Needs: selenium + a system google-chrome. Costs nothing; ~9s per page.
These are reviews of a MERCHANT, not of a product — good `why_quit` material,
and never a substitute for a marketplace review of a SKU.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time

from common import Result, load_env, save, spread_of, wall_check

# --- CHANGE ME -------------------------------------------------------------
EXAMPLE_COMPANY = "huel.com"
# ---------------------------------------------------------------------------

CHALLENGE_WAIT_S = 8   # the WAF challenge needs a beat to solve itself
PAGE_WAIT_S = 4        # subsequent navigations, token already held


def review_url(target: str, star: int | None, page: int) -> str:
    """Accept a bare domain, a slug, or a full /review/ url."""
    if target.startswith("http"):
        base = target.split("?")[0]
    else:
        base = f"https://www.trustpilot.com/review/{target.strip('/')}"
    params = []
    if star is not None:
        params.append(f"stars={star}")
    if page > 1:
        params.append(f"page={page}")
    return base + ("?" + "&".join(params) if params else "")


def open_browser():
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
    except ImportError:
        sys.exit("selenium is not installed:  pip install selenium\n(and a system google-chrome)")

    options = Options()
    for flag in (
        "--headless=new",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--window-size=1400,2000",
        "--disable-blink-features=AutomationControlled",
    ):
        options.add_argument(flag)
    # Chrome in a container writes dbus errors to stderr and works fine.
    # Do not read stderr output as failure.
    return webdriver.Chrome(options=options)


def reviews_from(html: str):
    """Trustpilot ships reviews as JSON inside __NEXT_DATA__.

    Read that rather than the DOM: it carries the rating as a number and the
    text unmodified, so nothing here has to un-format rendered markup.
    """
    match = re.search(
        r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.S
    )
    if not match:
        return None
    try:
        return json.loads(match.group(1))["props"]["pageProps"].get("reviews", [])
    except (json.JSONDecodeError, KeyError):
        return None


def fetch(target: str = EXAMPLE_COMPANY, star: int | None = 3, page: int = 1, driver=None) -> Result:
    url = review_url(target, star, page)
    result = Result(crawler="trustpilot/direct", target=url, cost_usd=0.0)

    own_driver = driver is None
    driver = driver or open_browser()
    started = time.monotonic()
    try:
        driver.get(url)
        time.sleep(CHALLENGE_WAIT_S if own_driver else PAGE_WAIT_S)
        html = driver.page_source
        result.title = driver.title
    finally:
        if own_driver:
            driver.quit()
    result.elapsed_ms = int((time.monotonic() - started) * 1000)
    result.status = 200  # selenium does not surface it; the wall check is the real test

    result.chars = len(html)
    result.raw_path = save("trustpilot", target, "html", html)

    rows = reviews_from(html)
    if rows is None:
        is_wall, why = wall_check(html)
        result.wall = True
        result.note = (
            "no __NEXT_DATA__ — the WAF challenge did not clear. "
            + (why if is_wall else "page shape may have changed")
            + ". Treat a 403 as re-mint-and-retry, never as 'blocked'."
        )
        return result

    result.wall = False
    result.records = len(rows)
    result.ok = len(rows) > 0
    result.star_spread = spread_of(r.get("rating") for r in rows)
    if star is not None and rows:
        result.filter_honoured = set(result.star_spread) <= {star}
    body = json.dumps(rows, indent=2)
    result.raw_path = save("trustpilot", f"{target}-{star or 'all'}-p{page}", "json", body)
    if rows:
        text = str(rows[0].get("text", ""))[:160].replace("\n", " ")
        result.note = f"first: {text!r}"
    return result


def all_bands(target: str) -> list[Result]:
    """One browser, five bands — the whole spread for ~45s and nothing."""
    driver = open_browser()
    results = []
    try:
        driver.get(review_url(target, None, 1))
        time.sleep(CHALLENGE_WAIT_S)  # solve the challenge once, reuse the token
        for star in (1, 2, 3, 4, 5):
            results.append(fetch(target, star, 1, driver=driver))
    finally:
        driver.quit()
    return results


def main() -> int:
    load_env()
    parser = argparse.ArgumentParser(description="Read Trustpilot directly, with a real browser.")
    parser.add_argument("target", nargs="?", default=EXAMPLE_COMPANY, help="domain, slug or url")
    parser.add_argument("--stars", type=int, default=3, choices=[1, 2, 3, 4, 5])
    parser.add_argument("--all-stars", action="store_true", help="unfiltered sample")
    parser.add_argument("--all-bands", action="store_true", help="1..5 in one browser session")
    parser.add_argument("--page", type=int, default=1)
    args = parser.parse_args()

    if args.all_bands:
        from common import table

        results = all_bands(args.target)
        for result in results:
            result.print()
        print("\n" + table(results))
        print("\nA band with 0 records is an honest answer, not a failure.")
        return 0

    result = fetch(args.target, None if args.all_stars else args.stars, args.page)
    result.print()
    if result.raw_path:
        print(f"\nRead it:  jq . {result.raw_path} | less")
    return 0 if result.ok else 1


if __name__ == "__main__":
    sys.exit(main())
