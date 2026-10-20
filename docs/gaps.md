# Gaps

What is known to be missing or wrong in the avatar rewrite (`docs/spec.md`),
each checked against the code. When one is closed, strike it through with the
commit that closed it; do not delete it. The gaps file for the code before the
rewrite is in git history before `b6f45cc`.

## Before a deploy

1. **Logins would not carry over.** The rewrite's `users` and `accounts` tables
   start empty; the first start seeds only the `MRA_APP_USER` admin. Every other
   login and workspace is in the old `research_accounts` / `research_workspaces`
   and needs copying first. Nothing does that yet.
2. **The VPS compose file is the old one.** `deploy/vps/docker-compose.yaml`
   still forwards `APIFY_TOKEN`, the gate and judge models and `META_ACCESS_TOKEN`,
   and mounts `corpus`; it has not been checked against the new `settings.ts`.
3. **`setup.md` §5a "Pending" is not committed.** `setup.md` lives in the parent
   `agent-collection` repository.

## Stale documents

4. `README.md`, `HANDOFF.md`, `TODO.md`, `stage1-client-status.md`,
   `stage1-client-changes.md` and the `explain` skill still describe the app
   before the rewrite.

## Stage 1

5. **No ranking.** The spec's 0–100 ranking within direct and indirect groups
   needs stages 2 and 3; `competitors.rank_score` stays null.
6. **No product images or label reading.** Decided 2026-10-17: images go in
   Neon's object storage. `product_images` and `label_facts` exist and are
   empty.
7. **No economics, market size or Scira evaluation.**
7a. ~~**A price can be read wrong.**~~ Run `344caa7d` stored Ethale at 2246
    USD: the page showed "$22.46" (subscribe-and-save) beside "$29.95", and the
    agent submitted 2246. Since 2026-10-19 a price is refused unless it appears
    on the cited page as written (`PriceCheck`). Still open: which of two prices
    on a page is the one-off one is the agent's judgement (the prompt says), not
    checked; Shopify's `/products/<handle>.js` (29.95 for Ethale) could settle
    it for Shopify stores. Run `344caa7d`'s row still says 2246.
7b. **Pictures are hotlinked, not stored.** Product shots and logos are kept
    as addresses on the brands' own sites; copying them into Neon storage comes
    with label reading (6). A retailer url gives the retailer's logo.
8. **`claims_on_page` is re-typed by the model**, not copied by code from the
   page, against the rule that a model never copies content by writing it out.

7c. **Traction is shop-wide, and missing for marketplace listings.** Built
    2026-10-19: the free lookup orders the confirmation tiles by monthly visits,
    and stage 1 stores each Shopify shop's estimated monthly sales with the
    product's best-seller rank (8 credits a shop, measured). TrendTrack has no
    per-product sales; a share of the shop estimated from rank would rest on an
    assumed curve (12–27% for #1 of 23 under two plausible ones), so none is
    shown. Amazon listings have no shop: their "bought in past month", rating
    count and Best Sellers Rank are on the product page (free) or from Apify,
    and are not read yet.

## Stage 2

9. **Review sources not built:** Apify (the paid fallback when Woot breaks),
   Trustpilot, the Shopify review apps other than Judge.me (Yotpo, Okendo,
   Stamped, Loox, Shopify Product Reviews), Meta ad comments, Reddit and
   YouTube. A store on another app shows as "review app not supported" in the
   stage summary.
10. **Woot serves US Amazon only.** A run whose markets exclude the US still
    gets US reviews.
11a. **Measured on run `344caa7d` (2026-10-19):** Betterbrand shows a
    Trustpilot widget on its product page and Ethale shows "121 reviews" from an
    app not identified yet; both load Judge.me's script without keeping reviews
    there. Ethale got no reviews at all.
11. **No incremental refresh.** A rerun fetches every page again; duplicates are
    dropped on insert, so only the fetching is wasted.

## Stage 3

12. **No text-in-image pass.** The spec's second sweep for short-copy image ads
    with long on-image text (vision OCR) is not built.
13. **No widening when a niche is thin.** The spec's fallback (adjacent
    categories, a 1,500-character threshold) is not built; a thin niche simply
    reports how few ads it found.

13a. ~~**The sweep pays for rows it throws away.**~~ The sweep is gone (the scout
    agent replaced it, 2026-10-19). Every row a search returns is still billed;
    the scout chooses how many and has a search budget. The rerun of `344caa7d`
    (2026-10-19) used 540 TrendTrack credits ($4.81) across 40 searches to keep
    150 ads: every returned row is billed, including duplicates between the two
    sorts and across terms, short copy and brands at their cap. Each search's
    returned and kept counts are now recorded (`ads.searched` events, the stage
    summary), so the next run shows which searches to cut.

## Stage 5

15a. *Closed 2026-10-20.* Ads belonged to the product, not the run, so a
    rerun's avatars included ads kept by earlier attempts (run `344caa7d`
    placed ads from 207 stored, of which its own sweep kept 150). Migration 8
    gives each ad its run; stage 3 clears its run's ads before scouting. The
    207 already stored were given to the latest run of their product.
15b. *Closed 2026-10-20.* A completed stage could not be rerun. Any stage can
    now be rerun with the stages that use it (`Stages.toRerun`).

16. **The memory is per run.** A second analysis of the same product starts from
    an empty memory; the spec's segment memory (avatars carried across runs of
    one product) and pattern memory (across accounts) are not built.
17. **Stage 5 needs stage 3.** With no TrendTrack key, or a stage-3 failure, no
    avatars are built at all, even though the reviews alone could build them.

## Costs

18. **Firecrawl pages are unpriced** while `MRA_FIRECRAWL_USD_PER_PAGE` is
    unset: run `344caa7d` read 16 pages and counted them as unpriced charges.

## Verification

14. ~~**The rewrite's UI has not been seen in a browser.**~~ Seen on
    2026-10-19 through headless Chrome (Playwright with `/usr/bin/google-chrome`,
    from `review-crawler`'s environment), the Chrome extension still not
    connected.
15. **`check-conventions.mjs` hung once for over 100 s** on 2026-10-17 and was
    not reproduced; every later run took under 2 s.
