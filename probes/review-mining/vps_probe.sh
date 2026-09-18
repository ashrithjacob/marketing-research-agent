#!/usr/bin/env bash
# Review-mining reachability probe, to be run ON THE VPS (ssh owui).
# Produces the matrix in spec-review-mining.md §11. Read-only; touches no service.
#
#   scp probes/review-mining/vps_probe.sh owui:/tmp/ && ssh owui 'bash /tmp/vps_probe.sh'
#
# Needs: curl, python3, docker. Pulls zenika/alpine-chrome (958MB) on first run.
# Firecrawl checks are skipped unless FIRECRAWL_API_KEY is set, e.g.
#   set -a; . /home/ash/mra-compose/.env; set +a

set -u
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
CHROME_IMG=zenika/alpine-chrome:latest

say() { printf '\n=== %s ===\n' "$*"; }

say "vantage point"
curl -s -m 15 https://ipinfo.io/json | python3 -c 'import json,sys;d=json.load(sys.stdin);print(" ",d.get("ip"),d.get("org"),d.get("country"))'

# --- Trustpilot -------------------------------------------------------------
# Expect: 403 + 991 bytes + awswaf. That is the JS challenge, NOT a block.
say "Trustpilot, plain curl (expect 403 / 991 bytes / awswaf)"
code=$(curl -s --compressed -m 25 -o "$W/tp.html" -w '%{http_code}' -A "$UA" https://www.trustpilot.com/review/huel.com)
printf '  http=%s bytes=%s awswaf=%s\n' "$code" "$(stat -c%s "$W/tp.html")" "$(grep -c awswaf "$W/tp.html" || true)"

say "Trustpilot, headless Chrome (expect 20 reviews per star band)"
docker image inspect "$CHROME_IMG" >/dev/null 2>&1 || { echo "  pulling $CHROME_IMG …"; docker pull -q "$CHROME_IMG"; }
for s in "" "?stars=3"; do
  t0=$(date +%s)
  timeout 180 docker run --rm --shm-size=1g "$CHROME_IMG" \
    --no-sandbox --headless=new --disable-gpu --disable-dev-shm-usage \
    --disable-blink-features=AutomationControlled \
    --virtual-time-budget=20000 --timeout=30000 \
    --dump-dom "https://www.trustpilot.com/review/huel.com${s}" > "$W/tp_dom.html" 2>/dev/null
  el=$(( $(date +%s) - t0 ))
  LBL="${s:-(unfiltered)}" EL="$el" python3 - "$W/tp_dom.html" <<'PY'
import re,json,sys,os
from collections import Counter
h=open(sys.argv[1],encoding='utf-8',errors='ignore').read()
m=re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',h,re.S)
lbl,el=os.environ['LBL'],os.environ['EL']
if not m: print(f"  {lbl:14} -> NO __NEXT_DATA__ (challenge unsolved) [{el}s]"); raise SystemExit
rv=json.loads(m.group(1))['props']['pageProps'].get('reviews',[])
print(f"  {lbl:14} -> n={len(rv)} spread={dict(sorted(Counter(r['rating'] for r in rv).items()))} [{el}s]")
PY
done

# --- Amazon -----------------------------------------------------------------
# NOTE: --compressed is mandatory. Without it the gzip body looks like a large
# page and every grep silently reports "binary file matches".
say "Amazon /dp/, 5x curl --compressed (expect mostly BOT-BLOCK at HTTP 200)"
for i in 1 2 3 4 5; do
  code=$(curl -s --compressed -m 30 -o "$W/az.html" -w '%{http_code}' -A "$UA" \
         -H 'Accept-Language: en-US,en;q=0.9' https://www.amazon.com/dp/B000BD0RT0)
  sz=$(stat -c%s "$W/az.html")
  n=$(grep -o 'data-hook="review"' "$W/az.html" | wc -l)
  if   grep -q 'api-services-support@amazon' "$W/az.html"; then cls='BOT-BLOCK (note: HTTP 200!)'
  elif [ "$n" -gt 0 ]; then cls="REVIEWS($n)"
  else cls='PAGE-NO-REVIEWS (aggregates only)'; fi
  printf '  try%s http=%s bytes=%s %s\n' "$i" "$code" "$sz" "$cls"
  sleep 3
done

say "Amazon /dp/, headless Chrome (expect bot page — the block is by address)"
timeout 180 docker run --rm --shm-size=1g "$CHROME_IMG" \
  --no-sandbox --headless=new --disable-gpu --disable-dev-shm-usage \
  --disable-blink-features=AutomationControlled \
  --virtual-time-budget=20000 --timeout=30000 \
  --dump-dom https://www.amazon.com/dp/B000BD0RT0 > "$W/azc.html" 2>/dev/null
printf '  bytes=%s reviews=%s bot_block=%s\n' \
  "$(stat -c%s "$W/azc.html")" \
  "$(grep -o 'data-hook="review"' "$W/azc.html" | wc -l)" \
  "$(grep -c 'api-services-support' "$W/azc.html" || true)"

say "Amazon via Firecrawl"
if [ -n "${FIRECRAWL_API_KEY:-}" ]; then
  for mode in basic stealth; do
    curl -s -m 200 -X POST https://api.firecrawl.dev/v1/scrape \
      -H "Authorization: Bearer $FIRECRAWL_API_KEY" -H 'Content-Type: application/json' \
      -d "{\"url\":\"https://www.amazon.com/dp/B000BD0RT0\",\"formats\":[\"html\"],\"onlyMainContent\":false,\"waitFor\":6000,\"proxy\":\"$mode\"}" \
      -o "$W/fc.json"
    MODE=$mode python3 - "$W/fc.json" <<'PY'
import json,re,sys,os
d=json.load(open(sys.argv[1])); h=(d.get('data') or {}).get('html','') or ''
print("  proxy=%-8s ok=%s html=%d reviews=%d bot_block=%s" % (
    os.environ['MODE'], d.get('success'), len(h),
    len(re.findall(r'data-hook="review"',h)), 'api-services-support' in h))
PY
  done
else
  echo '  skipped — FIRECRAWL_API_KEY not set'
fi

# --- Reddit -----------------------------------------------------------------
say "Reddit (expect 403 unauthenticated; 401 from token endpoint = alive, needs app)"
printf '  search.json      http=%s\n' "$(curl -s --compressed -m 25 -o /dev/null -w '%{http_code}' -A "$UA" \
  'https://www.reddit.com/r/Supplements/search.json?q=magnesium&restrict_sr=1&limit=3')"
printf '  oauth token      http=%s\n' "$(curl -s -m 20 -o /dev/null -w '%{http_code}' -A "$UA" \
  -X POST -d 'grant_type=client_credentials' https://www.reddit.com/api/v1/access_token)"

say "done"
