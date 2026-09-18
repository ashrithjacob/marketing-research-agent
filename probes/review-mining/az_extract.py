"""Amazon /dp/ review extractor against current (2026-09) markup."""
import re, html, sys, json
from collections import Counter

def extract(path):
    h = open(path, encoding="utf-8", errors="ignore").read()
    # split on review containers
    parts = re.split(r'(?=<div id="R[A-Z0-9]+"[^>]*data-hook="review")', h)
    out = []
    for p in parts[1:]:
        rid = re.search(r'<div id="(R[A-Z0-9]+)"', p)
        star = re.search(r'data-hook="review-star-rating"[^>]*>\s*<span class="a-icon-alt">([\d.]+) out of 5', p)
        title = re.search(r'data-hook="reviewTitle"[^>]*>(.*?)</h5>', p, re.S)
        date = re.search(r'data-hook="review-date"[^>]*>(.*?)</span>', p, re.S)
        body = re.search(r'data-hook="reviewRichContentContainer"[^>]*>(.*?)</div>\s*</div>', p, re.S)
        verified = 'avp-badge' in p
        def clean(m):
            if not m: return None
            return html.unescape(re.sub(r'<[^>]+>', ' ', m.group(1))).strip()
        out.append({
            "id": rid.group(1) if rid else None,
            "star": float(star.group(1)) if star else None,
            "title": clean(title),
            "date": clean(date),
            "verified": verified,
            "text": clean(body),
        })
    return out

rv = extract(sys.argv[1])
full = [r for r in rv if r["text"] and r["star"]]
print("containers:", len(rv), " complete(text+star):", len(full))
print("star spread:", dict(sorted(Counter(r["star"] for r in full).items())))
print("verified:", sum(r["verified"] for r in full), "/", len(full))
print("has 3-star:", any(r["star"] == 3 for r in full))
print()
for r in full[:4]:
    print(f"[{r['star']}*] {r['date']} verified={r['verified']}")
    print(f"   title: {r['title']}")
    print(f"   text : {(r['text'] or '')[:200]}")
    print()
