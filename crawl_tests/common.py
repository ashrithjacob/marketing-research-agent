"""
Shared plumbing for the four crawler probes.

Everything here exists so the four scripts can be compared *fairly*: the same
wall heuristic, the same timing, the same record shape, the same place on disk
for raw output. A comparison where each script prints its own vendor's idea of
success is not a comparison.

Zero third-party dependencies on purpose (urllib, not requests) — except
`crawl_trustpilot.py`, which needs a real browser and says so.
"""

from __future__ import annotations

import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"

# Where to look for secrets, in order. The first file that exists wins, and
# values already in the environment always win over a file.
#
# HERE.parent is the marketing-research-agent repo root, whose (gitignored)
# .env already holds FIRECRAWL_API_KEY and APIFY_TOKEN — so on a working
# checkout these scripts need no .env of their own.
ENV_CANDIDATES = [
    HERE / ".env",
    HERE.parent / ".env",
    HERE.parent / "deploy" / "vps" / ".env",
]


def load_env() -> Path | None:
    """Read KEY=value lines into os.environ without overwriting what is set."""
    for path in ENV_CANDIDATES:
        if not path.is_file():
            continue
        for line in path.read_text(errors="replace").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key, value = key.strip(), value.strip().strip("'\"")
            if key and value and key not in os.environ:
                os.environ[key] = value
        return path
    return None


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


def need(name: str, why: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        sys.exit(f"{name} is not set — {why}\nLooked in: " + ", ".join(str(p) for p in ENV_CANDIDATES))
    return value


# --- the wall heuristic ----------------------------------------------------
#
# A bot wall arrives as a *successful* fetch: HTTP 200, well-formed, and short.
# marketing-research-agent has this exact hole in production (workings.md:459 —
# "a bot wall is not detected on web_fetch"), so every probe here runs the same
# check and every probe reports it. Patterns are measured, from
# spec-review-mining.md §2.1 and §3.1 and spec-stage-1.md §2.5.
#
# STRONG: text that only ever appears ON a wall. Matched at any length.
WALL_STRONG = [
    "verifying your connection",
    "to discuss automated access to amazon data",
    "enter the characters you see",
    "robot check",
    "we do not support this site",   # Firecrawl's own refusal
    "awswaf.com/",                   # the challenge script's own host
]

# WEAK: words a real page says innocently. Only a wall when the body is ALSO
# too short to be a page. Measured the hard way on the first run of this
# folder: huel.com's newsletter form carries "this site is protected by
# reCAPTCHA", and a bare "captcha" substring flagged a perfectly good 20 181
# character product page as a wall. A checker that cries wolf on real pages is
# worse than no checker, because you stop reading it.
WALL_WEAK = [
    "captcha",
    "access denied",
    "are you a human",
    "just a moment",          # Cloudflare interstitial
    "checking your browser",
]

# Under this many characters, a "page" is almost never a page. Anakin calls the
# same idea minContentLength; this mirrors it so the comparison is like for like.
WALL_MIN_CHARS = 2000

# A weak pattern is only suspicious in a body this short. Comfortably above a
# challenge page (the measured ones are 991 B and 3.7 KB) and comfortably below
# a real product page.
WALL_WEAK_MAX_CHARS = 8000


def wall_check(text: str) -> tuple[bool, str]:
    """(is_wall, why). A known challenge string, or a body too short to be a page."""
    body = (text or "").lower()
    size = len(body.strip())

    hit = next((p for p in WALL_STRONG if p in body), None)
    if hit:
        return True, f"matched {hit!r} ({size} chars)"
    if size < WALL_MIN_CHARS:
        return True, f"only {size} chars (< {WALL_MIN_CHARS})"
    if size < WALL_WEAK_MAX_CHARS:
        hit = next((p for p in WALL_WEAK if p in body), None)
        if hit:
            return True, f"matched {hit!r} in a short body ({size} chars)"
    return False, ""


# --- Amazon reviews, out of whatever a crawler returned --------------------
#
# The selectors are the ones measured against live markup in 2026-09 and
# recorded in spec-review-mining.md §9. Every guide online is stale, and the
# stale ones fail SILENTLY: `data-hook="review-body"` and
# `data-hook="reviewTextContent"` both return zero matches on a page that has
# thirteen reviews. That is why this reports a diagnosis and not just a count.

def is_amazon(url: str) -> bool:
    """Any Amazon marketplace. The comparison targets amazon.com (US)."""
    from urllib.parse import urlparse

    host = (urlparse(url).hostname or "").lower()
    return "amazon." in host


AMZ_CONTAINER = r'(?=<div id="R[A-Z0-9]+"[^>]*data-hook="review")'
AMZ_STAR = r'data-hook="review-star-rating"[^>]*>\s*<span class="a-icon-alt">([\d.]+) out of 5'
AMZ_TITLE = r'data-hook="reviewTitle"[^>]*>(.*?)</h5>'
AMZ_DATE = r'data-hook="review-date"[^>]*>(.*?)</span>'
AMZ_BODY = r'data-hook="reviewRichContentContainer"[^>]*>(.*?)</div>\s*</div>'

# Markers that say WHY a page has no reviews on it. Measured 2026-09-22 against
# amazon.com/dp/B000BD0RT0 through Firecrawl: 1.46 MB of real product page,
# HTTP 200, no bot page — and zero review containers, because the review block
# is a placeholder that loads separately and prompts a sign-in in the slot.
AMZ_PLACEHOLDER = ["cm-cr-dp-reviews-loading-wrapper", "cr-reviews-loading"]
AMZ_SIGNIN = ["cm-cr-dp-sign-in-prompt"]


def group1(pattern: str, text: str) -> str:
    """First capture group with tags stripped and entities decoded, or ""."""
    match = re.search(pattern, text, re.S)
    if not match:
        return ""
    return html.unescape(re.sub(r"<[^>]+>", " ", match.group(1))).strip()


def amazon_reviews(body: str) -> tuple[list[dict], str]:
    """(rows, diagnosis) for any Amazon body — html or markdown.

    A count alone cannot be read: zero reviews means one of four very different
    things, and only one of them is "this product has no reviews". The
    diagnosis says which.
    """
    if not body:
        return [], "empty body"

    rows = []
    for part in re.split(AMZ_CONTAINER, body)[1:]:
        star = group1(AMZ_STAR, part)
        rows.append(
            {
                "id": group1(r'<div id="(R[A-Z0-9]+)"', part),
                "star": float(star) if star else None,
                "title": group1(AMZ_TITLE, part),
                "date": group1(AMZ_DATE, part),
                "verified": "avp-badge" in part,
                "text": group1(AMZ_BODY, part),
            }
        )
    complete = [r for r in rows if r["text"] and r["star"]]
    if complete:
        return complete, f"{len(complete)} complete of {len(rows)} containers"

    # Markdown fallback: Firecrawl's default format has no data-hooks left, so
    # count the one string Amazon puts on every review and nowhere else.
    md = re.findall(r"Reviewed in .{1,40} on \w+ \d{1,2}, \d{4}", body)
    if md:
        return (
            [{"star": None, "text": "", "date": d, "verified": None, "title": ""} for d in md],
            f"{len(md)} review datelines in markdown — text not separable without html",
        )

    if any(marker in body for marker in AMZ_SIGNIN):
        return [], (
            "review slot holds a SIGN-IN PROMPT — the page wants an account "
            "before it shows reviews. Not an absence of reviews."
        )
    if any(marker in body for marker in AMZ_PLACEHOLDER):
        return [], (
            "review section is an UNLOADED PLACEHOLDER — /dp/ defers reviews to a "
            "later request, so a single-shot fetch can never contain them. "
            "Not an absence of reviews."
        )
    if "out of 5 stars" in body:
        return [], (
            "star aggregate present but no review containers — either the "
            "selectors have gone stale (§9) or the reviews were never in this body"
        )
    return [], "no review markup of any kind on this page"


# --- the shared record -----------------------------------------------------


@dataclass
class Result:
    """One crawler's answer about one target, in a shape the others share."""

    crawler: str
    target: str
    ok: bool = False
    status: int | None = None
    elapsed_ms: int = 0
    chars: int = 0             # page crawlers: characters of text returned
    title: str = ""
    records: int | None = None  # review crawlers: rows returned. None = N/A.
    star_spread: dict = field(default_factory=dict)
    wall: bool | None = None
    filter_honoured: bool | None = None  # asked for N stars, got N stars?
    cost_usd: float | None = None
    # True when cost_usd is a spend CEILING rather than what was charged.
    # Apify caps a run server-side; the console is the authority on the bill.
    cost_is_cap: bool = False
    note: str = ""
    raw_path: str = ""

    def cost_label(self) -> str:
        if self.cost_usd == 0:
            return "free"
        if self.cost_usd is None:
            return "—"
        return f"${self.cost_usd} CAP (not the charge)" if self.cost_is_cap else f"~${self.cost_usd}"

    def print(self) -> None:
        mark = "ok " if self.ok else "FAIL"
        print(f"\n{'=' * 72}")
        print(f"[{mark}] {self.crawler}  ->  {self.target}")
        print(f"{'=' * 72}")
        rows = [
            ("http", self.status),
            ("elapsed", f"{self.elapsed_ms} ms"),
            ("chars", self.chars if self.chars else "—"),
            ("title", (self.title[:60] + "…") if len(self.title) > 60 else (self.title or "—")),
            ("records", "n/a" if self.records is None else self.records),
            ("star spread", self.star_spread or "—"),
            ("filter honoured", "n/a" if self.filter_honoured is None else self.filter_honoured),
            ("WALL", "n/a" if self.wall is None else ("YES — " + self.note if self.wall else "no")),
            ("cost", self.cost_label()),
            ("raw", self.raw_path or "—"),
        ]
        for label, value in rows:
            print(f"  {label:<16} {value}")
        if self.note and not self.wall:
            print(f"  {'note':<16} {self.note}")


def save(crawler: str, target: str, suffix: str, body: str) -> str:
    """Write raw output for eyeballing. Returns the path, relative to here."""
    OUT.mkdir(exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    name = f"{crawler}-{slug(target)}-{stamp}.{suffix}"
    path = OUT / name
    path.write_text(body, errors="replace")
    return str(path.relative_to(HERE))


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:48] or "target"


# --- http ------------------------------------------------------------------


def post_json(url: str, payload: dict, headers: dict, timeout: int) -> tuple[int, dict | list, str]:
    """POST JSON, return (status, decoded, raw_body). Never raises on 4xx/5xx."""
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode(errors="replace")
            return response.status, decode(raw), raw
    except urllib.error.HTTPError as error:
        raw = error.read().decode(errors="replace")
        return error.code, decode(raw), raw
    except Exception as error:  # socket timeouts, DNS, connection refused
        return 0, {"_error": f"{type(error).__name__}: {error}"}, ""


def decode(raw: str):
    try:
        return json.loads(raw or "null")
    except json.JSONDecodeError:
        return {"_undecodable": raw[:400]}


def timed(fn):
    """Run fn(), return (value, elapsed_ms)."""
    start = time.monotonic()
    value = fn()
    return value, int((time.monotonic() - start) * 1000)


def spread_of(values) -> dict:
    return dict(sorted(Counter(v for v in values if v is not None).items(), key=lambda kv: str(kv[0])))


# --- the comparison table --------------------------------------------------


def table(results: list[Result]) -> str:
    """Side by side. The columns are the things that actually differ."""
    head = ("crawler", "ok", "ms", "chars", "recs", "wall", "filter", "cost")
    rows = [head]
    for r in results:
        rows.append(
            (
                r.crawler,
                "yes" if r.ok else "NO",
                str(r.elapsed_ms),
                str(r.chars or "—"),
                "n/a" if r.records is None else str(r.records),
                "n/a" if r.wall is None else ("YES" if r.wall else "no"),
                "n/a" if r.filter_honoured is None else ("yes" if r.filter_honoured else "NO"),
                r.cost_label(),
            )
        )
    widths = [max(len(row[i]) for row in rows) for i in range(len(head))]
    lines = []
    for index, row in enumerate(rows):
        lines.append("  ".join(cell.ljust(widths[i]) for i, cell in enumerate(row)).rstrip())
        if index == 0:
            lines.append("  ".join("-" * w for w in widths))
    return "\n".join(lines)
