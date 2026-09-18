"""Star filter + pagination + WAF-token harvest, measured."""
import time, json, re
from collections import Counter
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

opts = Options()
for a in ("--headless=new","--no-sandbox","--disable-dev-shm-usage",
          "--window-size=1400,2000","--disable-blink-features=AutomationControlled"):
    opts.add_argument(a)

def reviews_from(html):
    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.S)
    if not m: return None
    return json.loads(m.group(1))["props"]["pageProps"].get("reviews", [])

d = webdriver.Chrome(options=opts)
try:
    # warm up / solve challenge once
    d.get("https://www.trustpilot.com/review/huel.com"); time.sleep(8)

    for label, url in [
        ("stars=3",      "https://www.trustpilot.com/review/huel.com?stars=3"),
        ("stars=1",      "https://www.trustpilot.com/review/huel.com?stars=1"),
        ("page=2",       "https://www.trustpilot.com/review/huel.com?page=2"),
        ("stars=3&pg2",  "https://www.trustpilot.com/review/huel.com?stars=3&page=2"),
    ]:
        d.get(url); time.sleep(4)
        rv = reviews_from(d.page_source)
        if rv is None:
            print(f"{label:14} -> NO NEXT_DATA (challenge?)"); continue
        ids = [r["id"] for r in rv]
        print(f"{label:14} -> n={len(rv):3} spread={dict(Counter(r['rating'] for r in rv))} first_id={ids[0][:8] if ids else '-'}")

    # harvest cookies: can plain HTTP reuse the WAF token?
    cookies = {c["name"]: c["value"] for c in d.get_cookies()}
    print("\nCOOKIE NAMES:", sorted(cookies.keys()))
    json.dump(cookies, open("tp_cookies.json","w"))
    print("UA:", d.execute_script("return navigator.userAgent"))
finally:
    d.quit()
