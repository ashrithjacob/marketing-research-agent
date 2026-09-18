"""Does a real browser clear Trustpilot's AWS WAF challenge? Measured, not assumed."""
import sys, time, json, re
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

url = sys.argv[1] if len(sys.argv) > 1 else "https://www.trustpilot.com/review/huel.com"

opts = Options()
opts.add_argument("--headless=new")
opts.add_argument("--no-sandbox")
opts.add_argument("--disable-dev-shm-usage")
opts.add_argument("--window-size=1400,2000")
opts.add_argument("--disable-blink-features=AutomationControlled")

d = webdriver.Chrome(options=opts)
try:
    d.get(url)
    time.sleep(8)  # give the WAF challenge time to solve itself
    html = d.page_source
    title = d.title
    print("TITLE:", title)
    print("LEN:", len(html))
    print("WAF_CHALLENGE_PRESENT:", "awswaf" in html or "Verifying your connection" in html)
    # Trustpilot embeds reviews as JSON-LD / __NEXT_DATA__
    print("HAS_NEXT_DATA:", "__NEXT_DATA__" in html)
    m = re.findall(r'"reviewBody"\s*:\s*"', html)
    print("reviewBody_occurrences:", len(m))
    # count visible review cards
    cards = d.find_elements("css selector", "[data-service-review-card-paper]")
    print("review_cards:", len(cards))
    stars = d.find_elements("css selector", "[data-service-review-rating]")
    print("rating_nodes:", len(stars))
    open("tp_browser_out.html", "w").write(html)
    if cards:
        t = cards[0].text[:400]
        print("FIRST_CARD:\n", t)
finally:
    d.quit()
