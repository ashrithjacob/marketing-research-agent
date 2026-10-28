# Stage 3: how the long-form ads are found and read

As built 2026-10-26. The interactive version, with diagrams and a step-through,
is `stage3-long-form-ads.html` in this folder.

Stage 3 takes the market's top long-form ads for the product's ingredient,
about 350 for mullein, and reads each different ad text once. Before
2026-10-26 an agent (the scout) chose its own searches; on the Mullevia run it
kept 5 ads.

**Status.** The pool and the reading ran for real on run `344caa7d` on
2026-10-26. The run then stopped at the angle grouper. That step is rebuilt
and passes its tests, but it has not run on real ads yet.

## The flow, step by step

Numbers are from run `344caa7d` (Mullevia Mullein Drops, US), 2026-10-26.

| # | Step | Who | What happens | Code |
|---|---|---|---|---|
| 1 | Find the search word | code | Keep the words the key ingredient and the product name share: "Mullein Leaf" + "Mullevia Mullein Drops" gives `mullein`. If they share none, search the ingredient as written. | `agent/stages/ads/ad-pool.ts:16-21` |
| 2 | Pull the pool | code | Ask TrendTrack for US long-form image ads (2,000+ characters) that mention the word, under four sorts: longest running, most duplicated, reach, 7-day reach growth. 100 ads per sort, in pages of 50. Each ad kept once. 8 requests, 600 credits, $5.34, 11 seconds. | `ad-pool.ts:23-36` |
| 3 | Store and bucket | code | Save every ad (351). Link it to a confirmed competitor when the landing site matches. Set its bucket from its own numbers (see below). | `adapters/store/ad-table.ts:15-34`, `domain/ads.ts:92-106` |
| 4 | Group into scripts | code | Ads with the same text, ignoring capitals, spaces and punctuation, form one script. 351 ads held 161 scripts; the biggest ran as 75 ads. | `extract/ad-scripts.ts:6-19` |
| 5 | Read one ad per script | agent `ad_reader:<n>` | 8 scripts per call, 3 calls at once, low reasoning. Records the ring, who the ad speaks to, claim type, awareness, proof, offer and the closed lists. 28 calls in about 3.5 minutes. | `competitor-ad-stage.ts:68-92`, `ad-reader.ts` |
| 6 | Copy and drop | code | Copy each reading to every ad of its script. Delete ads marked off-market (10, such as dog-cough chews). 341 stay: 284 direct competitor, 36 same problem, 5 same buyer, 16 unread. | `competitor-ad-stage.ts:46-47` |
| 7 | Group into angles | agent `angle_grouper` | One call sees each script once under a handle (s1, s2, …) and puts it in one angle. Code then puts every ad of the script on that angle. **Not yet run on real ads.** | `angle-grouper.ts:13-27` |
| 8 | Fit and findings | agents `angle_fitter`, `ads_findings` | One agent judges whether the client's own claims back each angle. Code counts the tables. One agent writes a headline per step; code refuses a headline with a digit. | `angle-fitter.ts`, `findings-writer.ts` |
| 9 | Page and later stages | code | The ads page counts the analysis on every load. Stage 4 reads the ads. Stage 5 places direct-competitor and same-problem ads on the avatars. | `ad-analysis-step.ts`, `domain/ads.ts:111-114` |

## The bucket: how code decides an ad is doing well

`AdBuckets.of` (`domain/ads.ts:92-106`):

- **winning**: ran 10 days or more; or still running with 400+ reach growth in
  7 days, or 5+ copies.
- **testing**: still running, younger than 10 days, without that traction.
- **dead**: stopped before 10 days.

In this run: 226 winning, 13 testing, 102 dead.

**Two rules for "doing well".** The bucket feeds stage 5 (the share of an
avatar's ads that are winning). The ads page's analysis uses a stricter rule,
*proven*: still running, 30+ days, 2+ copies (`extract/proven-rule.ts:9-12`).
The two give different counts and are not joined yet.

## Why it was built this way

| Choice | Why | Not taken |
|---|---|---|
| Code pulls the ads | The scout made 17 searches; 13 returned nothing. It asked for 5 of the 3,637 ads its one useful search found. | Tell the scout in its prompt to search more. A prompt rule does not stop the same mistake. |
| Read each script once | One script ran as 75 ads; 351 ads held 161 scripts. | Read all 351 ads: more than twice the calls for the same answers. |
| Code sets the bucket | A copied reading cannot carry each ad's own days and reach. The 10-day line is the owner's rule. | Let the reader judge each bucket. |
| Drop off-market ads | Ads can mention mullein and sell to someone else. | Keep them in a separate group. The owner chose to drop them for now. |
| Group scripts by handle | Placing 341 ads by 32-letter id in one call failed; the model left ads out and once hit the 40,000-token limit. | Split grouping over several calls, which could name the same angle twice. |

## See it yourself

1. Open `http://localhost:8080/runs/344caa7d25fe4c108ac0c7f7a936394a`. Stage 3's
   summary starts "351 ads pooled for "mullein" in 8 requests, 161 distinct
   scripts; 10 off-market ads dropped".
2. Run `.claude/skills/mra-control/bin/mra calls 344caa7d25fe4c108ac0c7f7a936394a`
   and look for `ad_reader:1` to `ad_reader:21`.
3. On the Long-form ads tab, each ad card's grey line is the bucket reason
   written by code, such as "ran 64 days".
