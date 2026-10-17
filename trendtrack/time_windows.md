---
title: Time windows
description: Pick the right current-ranking sort keys, historical time windows, snapshotDate, and freshness controls.
---

Use two separate mental models:

- **Current rankings** use `/top-ads?sortBy=...`. They are not snapshot-window queries.
- **Historical analytics** use endpoint-specific `period`, `timePeriod`, `timeWindow`, and optional `snapshotDate` controls where documented.

## Current ranking endpoints

| Goal                      | Endpoint                                         | Sort recipe                                                        |
| ------------------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| Brandtracker current rank | `GET /v1/brandtrackers/{brandtrackerId}/top-ads` | `sortBy=currentRank`                                               |
| Workspace current rank    | `GET /v1/workspace/top-ads`                      | `sortBy=currentRank`                                               |
| Reach ranking             | `/top-ads`                                       | `sortBy=reach`, `reachDelta1d`, `reachDelta7d`, or `reachDelta30d` |
| Rank movers               | `/top-ads`                                       | `sortBy=rankDelta7d`, `rankDelta14d`, or `rankDelta30d`            |

`period` and `snapshotDate` are deprecated compatibility parameters on these canonical top-ads ranking paths and are ignored. The response rank fields may appear as `rank` / `currentRank` depending on the object you are reading.

```bash title="Current rank example"
export TT_API_BASE_URL="https://api.trendtrack.io"
curl -s "$TT_API_BASE_URL/v1/brandtrackers/$BT/top-ads?sortBy=currentRank&limit=50" \
  -H "Authorization: Bearer $TT_API_KEY"
```

```bash title="Rank movers example"
curl -s "$TT_API_BASE_URL/v1/brandtrackers/$BT/top-ads?sortBy=rankDelta7d&limit=50" \
  -H "Authorization: Bearer $TT_API_KEY"
```

## Compatibility ranking endpoints

`GET /v1/brandtrackers/{brandtrackerId}/ad-rank`, `GET /v1/brandtrackers/{brandtrackerId}/scaling-ads`, and `GET /v1/workspace/scaling-ads` remain available for existing clients. For new integrations, prefer `/top-ads?sortBy=rankDelta7d|rankDelta14d|rankDelta30d`.

Compatibility notes:

- `timeWindow=last7d|last14d|last30d` maps to the corresponding rank-delta ranking.
- `snapshotDate` is deprecated and ignored on the ES-backed compatibility path.
- `trajectory` may be an empty array on the ES-backed path.

## Historical and freshness-aware endpoints

Other analytics endpoints can still use rolling windows and snapshot anchors. Check each operation page for the exact parameter name.

| Endpoint family                                                     | Parameter                                | Recommended default                         | Notes                                                                                                         |
| ------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Brandtracker hooks, landing pages, creatives, media mix, demography | `timePeriod`                             | Operation default, often `last7d`/`last30d` | Historical/freshness semantics still apply where documented.                                                  |
| Brandtracker overview                                               | `topAdsPeriod`, `landingPagesTimePeriod` | Operation default                           | Overview keeps its documented aggregate controls. Use `/top-ads?sortBy=...` for dedicated ranking drilldowns. |
| Workspace aggregate analytics                                       | `period`                                 | Operation default                           | Applies to historical aggregate endpoints such as hooks, landing pages, ad copies, and media mix.             |

## `snapshotDate` — historical anchor date

Where supported, `snapshotDate` fixes the "as-of" moment used to interpret statuses and resolve historical counts. It accepts a `YYYY-MM-DD` date or the literal string `latest`.

- **Omitted** (or `latest`) — historical analytics endpoints resolve to the latest **ready** snapshot date, not the latest scheduled/indexing date.
- **Specific date** — the response is reconstructed as it would have been on that date. `status: "active"` is interpreted relative to that snapshot.

## Snapshot readiness and freshness checks

Use these endpoints when you need explicit freshness guarantees:

- `GET /v1/brandtrackers/{brandtrackerId}/snapshots` returns:
  - `latestReadyDate`
  - `latestScheduledDate`
  - per-date readiness status (for example ready vs indexing)
- `GET /v1/system/freshness` returns global readiness (`latestReadyDate`, `latestScheduledDate`, `dataFreshnessLagDays`).

## Common pitfalls

- **Adding `period` to top-ads ranking calls.** It is accepted for compatibility but ignored. Choose the ranking with `sortBy` instead.
- **Using `/scaling-ads` for new rank-mover integrations.** Prefer `/top-ads?sortBy=rankDelta7d`, `rankDelta14d`, or `rankDelta30d`; compatibility endpoints may return empty `trajectory`.
- **Treating `latestScheduledDate` as query-ready.** Scheduled/indexing can be ahead of ready data; use `latestReadyDate` for stable historical reporting.

## Recommended defaults for agents

When building an agent that surveys a brandtracker once per session:

1. Resolve the brand with `GET /v1/brandtrackers?page=1&limit=100` and carry the matching `data[].id` as `brandtrackerId`.
2. Start with `GET /v1/brandtrackers/{brandtrackerId}/overview` for a broad read.
3. Use `GET /v1/brandtrackers/{brandtrackerId}/top-ads?sortBy=currentRank` for current winners.
4. Use `sortBy=rankDelta7d`, `rankDelta14d`, or `rankDelta30d` for rank movers.
5. Optionally check `GET /v1/system/freshness` when historical freshness is critical.
