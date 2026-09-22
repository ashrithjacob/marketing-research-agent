#!/usr/bin/env python3
"""
The two pieces of shared judgement in this folder: the bot-wall check and the
Amazon review extractor. Everything else here hits a live site and cannot be
asserted on.

The extractor especially needs pinning. `spec-review-mining.md` §9 puts it
bluntly: the wrong selector returns zero reviews from a page that has thirteen,
and nothing about the output says so. These fixtures are trimmed from real
markup served 2026-09.

    python3 test_common.py
"""

import sys

from common import WALL_MIN_CHARS, amazon_reviews, is_amazon, wall_check

PAGE = "a real product page. " * 1200  # ~24 000 chars

WALL_CASES = [
    ("empty", "", True),
    ("trustpilot waf challenge", "<title>Verifying Connection</title>"
        "<script src='https://x.edge.sdk.awswaf.com/y/z/challenge.js' defer></script>", True),
    ("amazon bot page", "Sorry, we just need to make sure you're not a robot. "
        "To discuss automated access to Amazon data please contact "
        "api-services-support@amazon.com." + "x" * 3000, True),
    ("firecrawl refusal", "we do not support this site", True),
    ("short but innocent", "x" * (WALL_MIN_CHARS - 1), True),
    # The regression that prompted this file: real page, innocent recaptcha line.
    ("real page with recaptcha boilerplate",
        PAGE + "This site is protected by reCAPTCHA and the Google Privacy Policy.", False),
    ("real page", PAGE, False),
    ("short page that really is a wall", "Access denied" + "x" * 2500, True),
]

# One real review container, as Amazon served it (ids and text shortened).
REVIEW_HTML = """
<div id="R2ABCDEF12345" data-hook="review" class="a-section review">
  <a data-hook="review-star-rating" class="a-link-normal" title="3.0 out of 5 stars">
    <span class="a-icon-alt">3.0 out of 5 stars</span></a>
  <h5><span data-hook="reviewTitle" class="a-size-base">Fine, not great</span></h5>
  <span data-hook="review-date">Reviewed in the United States on December 13, 2016</span>
  <span data-hook="avp-badge">Verified Purchase</span>
  <div data-hook="reviewRichContentContainer"><span>Works, but the pills are huge &amp; chalky.</span>
  </div>
</div>
"""

# What the /dp/ page actually returns today: the review block is a placeholder
# that loads separately, with a sign-in prompt in the slot. Measured
# 2026-09-22 on amazon.com/dp/B000BD0RT0 through Firecrawl, 1.46 MB, HTTP 200.
PLACEHOLDER_HTML = (
    "<div id='reviewsMedley'>" + "product copy " * 500
    + "<div id='cm-cr-dp-reviews-loading-wrapper' class='cr-reviews-loading'></div>"
    + "<span>4.6 out of 5 stars</span></div>"
)
SIGNIN_HTML = PLACEHOLDER_HTML + "<a data-csa-c-slot-id='cm-cr-dp-sign-in-prompt'>Sign in</a>"

AMAZON_CASES = [
    # (label, body, expected_rows, expected_phrase_in_diagnosis)
    ("two complete reviews", REVIEW_HTML * 2, 2, "complete"),
    ("unloaded placeholder", PLACEHOLDER_HTML, 0, "PLACEHOLDER"),
    ("sign-in prompt wins over placeholder", SIGNIN_HTML, 0, "SIGN-IN"),
    ("markdown datelines", "Reviewed in the United States on March 3, 2024\n"
        "Reviewed in the United States on April 1, 2025", 2, "datelines"),
    ("star aggregate only", "4.6 out of 5 stars" + " copy" * 400, 0, "stale"),
    ("nothing at all", "an unrelated page", 0, "no review markup"),
    ("empty", "", 0, "empty body"),
]

HOST_CASES = [
    ("https://www.amazon.com/dp/B000BD0RT0", True),
    ("https://amazon.co.uk/dp/B000BD0RT0", True),
    ("https://www.trustpilot.com/review/huel.com", False),
    ("not a url", False),
]


def main() -> int:
    failures = 0

    print("wall_check")
    for label, body, expected in WALL_CASES:
        got, why = wall_check(body)
        ok = got == expected
        failures += not ok
        print(f"  {'ok  ' if ok else 'FAIL'}  {label:<40} wall={got}  {why}")

    print("\namazon_reviews")
    for label, body, rows_expected, phrase in AMAZON_CASES:
        rows, diagnosis = amazon_reviews(body)
        ok = len(rows) == rows_expected and phrase.lower() in diagnosis.lower()
        failures += not ok
        print(f"  {'ok  ' if ok else 'FAIL'}  {label:<40} rows={len(rows)}  {diagnosis[:58]}")

    print("\namazon_reviews: the fields survive extraction")
    rows, _ = amazon_reviews(REVIEW_HTML)
    checks = [
        ("star", rows[0]["star"] == 3.0),
        ("title", rows[0]["title"] == "Fine, not great"),
        ("verified", rows[0]["verified"] is True),
        ("date", "December 13, 2016" in rows[0]["date"]),
        ("text entities decoded", "&" in rows[0]["text"] and "&amp;" not in rows[0]["text"]),
    ]
    for label, ok in checks:
        failures += not ok
        print(f"  {'ok  ' if ok else 'FAIL'}  {label}")

    print("\nis_amazon")
    for url, expected in HOST_CASES:
        ok = is_amazon(url) == expected
        failures += not ok
        print(f"  {'ok  ' if ok else 'FAIL'}  {url}")

    total = len(WALL_CASES) + len(AMAZON_CASES) + len(checks) + len(HOST_CASES)
    print(f"\n{total - failures}/{total} passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
