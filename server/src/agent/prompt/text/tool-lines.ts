export const WEB_SEARCH_LINE = "- `web_search` — titles, urls and snippets. A snippet is never a source.\n";

export const WEB_FETCH_LINE = "- `web_fetch` — one page's text, archived; the result carries the `source_id` to cite.\n";

export const EVIDENCE_SEARCH_LINE =
  "- `web_search` — results carry excerpts read off each page, archived, each with a `source_id` to record and cite. `domains` limits a search to named sites.\n";

export const EVIDENCE_FETCH_LINE = "- `web_fetch` — one page's full text, archived; the result carries the `source_id` to cite.\n";

export const DISCOVER_LINE =
  "- `discover_competitors` — once: a research pass over the whole web names brands selling to the champion's customer. Candidates to fetch, never facts to record.\n";

export const AD_LIBRARY_LINE =
  "- `ad_library_search` — Meta ads, live and past: who advertises, the copy, where each ad lands, when it ran, its reach. Each ad is archived and citable as an `ad_library` source. Costs a credit per ad.\n";

export const AMAZON_SEARCH_LINE =
  "- `amazon_find_product` — search Amazon (amazon.com) by product name for asin, title, stars " +
  "and `reviewsCount`, most-reviewed first: how the genre is ranked to pick the champion " +
  "product, and a way to find competitors and see which sell. It may be absent.\n";
