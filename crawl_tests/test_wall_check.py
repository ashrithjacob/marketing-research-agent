#!/usr/bin/env python3
"""
The wall check is the one piece of shared judgement in this folder, so it gets
the one test. Everything else here is a probe against a live site and cannot be
asserted on.

    python3 test_wall_check.py
"""

import sys

from common import WALL_MIN_CHARS, wall_check

PAGE = "a real product page. " * 1200  # ~24 000 chars

CASES = [
    # (label, body, expected_wall)
    ("empty", "", True),
    ("trustpilot waf challenge", "<title>Verifying Connection</title>"
        "<script src='https://x.edge.sdk.awswaf.com/y/z/challenge.js' defer></script>", True),
    ("amazon bot page", "Sorry, we just need to make sure you're not a robot. "
        "To discuss automated access to Amazon data please contact "
        "api-services-support@amazon.com." + "x" * 3000, True),
    ("firecrawl refusal", "we do not support this site", True),
    ("short but innocent", "x" * (WALL_MIN_CHARS - 1), True),
    # The regression that prompted the test: real page, innocent recaptcha line.
    ("real page with recaptcha boilerplate",
        PAGE + "This site is protected by reCAPTCHA and the Google Privacy Policy.", False),
    ("real page", PAGE, False),
    ("short page that really is a wall", "Access denied" + "x" * 2500, True),
]


def main() -> int:
    failures = 0
    for label, body, expected in CASES:
        got, why = wall_check(body)
        ok = got == expected
        failures += not ok
        print(f"{'ok  ' if ok else 'FAIL'}  {label:<42} wall={got}  {why}")
    print(f"\n{len(CASES) - failures}/{len(CASES)} passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
