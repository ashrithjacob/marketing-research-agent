#!/usr/bin/env python3
"""
Run several crawlers against one target and print them side by side.

It picks the crawlers by host, because not every crawler can take every target:
Firecrawl and anakin take any url, the Apify Amazon actor takes an Amazon
product url only, and the direct Trustpilot route takes a company.

    python3 compare.py                                   # the example page
    python3 compare.py https://huel.com/products/huel-daily-greens
    python3 compare.py https://www.trustpilot.com/review/huel.com
    python3 compare.py https://www.amazon.com/dp/B000BD0RT0 --paid

Free crawlers run by default. Anything that spends money (the Apify actors)
runs only with --paid.
"""

from __future__ import annotations

import argparse
import sys
from urllib.parse import urlparse

import crawl_anakin
import crawl_apify
import crawl_firecrawl
import crawl_trustpilot
from common import Result, load_env, table

# --- CHANGE ME -------------------------------------------------------------
EXAMPLE_URL = "https://huel.com/products/huel-daily-greens"
# ---------------------------------------------------------------------------


def guarded(label: str, fn) -> Result:
    """One crawler failing should not end the comparison — that IS the result."""
    try:
        return fn()
    except SystemExit as exit_error:      # a missing key, from need()
        return Result(crawler=label, target="-", note=str(exit_error).split("\n")[0])
    except Exception as error:
        return Result(crawler=label, target="-", note=f"{type(error).__name__}: {error}")


def main() -> int:
    load_env()
    parser = argparse.ArgumentParser(description="Compare crawlers on one target.")
    parser.add_argument("url", nargs="?", default=EXAMPLE_URL)
    parser.add_argument("--paid", action="store_true", help="also run the Apify actors")
    parser.add_argument("--stars", type=int, default=3, choices=[1, 2, 3, 4, 5])
    parser.add_argument("--max", type=int, default=5, dest="max_items")
    parser.add_argument("--browser", action="store_true", help="anakin: force the Camoufox handler")
    args = parser.parse_args()

    host = (urlparse(args.url).hostname or "").lower().removeprefix("www.")
    results: list[Result] = []

    print(f"target: {args.url}\nhost:   {host or '(none)'}\n")

    # Every target, both page crawlers. This pair is the like-for-like one.
    results.append(guarded("firecrawl", lambda: crawl_firecrawl.fetch(args.url)))
    results.append(
        guarded("anakin", lambda: crawl_anakin.fetch(args.url, use_browser=args.browser))
    )

    if "trustpilot.com" in host:
        company = args.url.rstrip("/").split("/review/")[-1].split("?")[0]
        results.append(
            guarded("trustpilot/direct", lambda: crawl_trustpilot.fetch(company, args.stars))
        )
        if args.paid:
            results.append(
                guarded(
                    "apify/trustpilot",
                    lambda: crawl_apify.trustpilot_reviews(company, args.stars, args.max_items),
                )
            )
    elif "amazon." in host:
        if args.paid:
            results.append(
                guarded(
                    "apify/amazon",
                    lambda: crawl_apify.amazon_reviews(args.url, args.stars, args.max_items),
                )
            )
        else:
            print("(skipping the Apify Amazon actor — pass --paid to spend)\n")

    for result in results:
        result.print()

    print("\n" + "=" * 72)
    print(table(results))
    print("=" * 72)
    print(
        "\nReading this table:\n"
        "  chars   page crawlers only — how much text came back\n"
        "  recs    review crawlers only — rows of structured review\n"
        "  wall    a SUCCESSFUL fetch that is really a bot challenge.\n"
        "          'YES' next to a healthy char count is the failure that\n"
        "          matters: it gets archived and cited like a real page.\n"
        "  filter  asked for N stars and got N stars back\n"
    )
    print("Raw output for every row is under out/ — diff them by hand.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
