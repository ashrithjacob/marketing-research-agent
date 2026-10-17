---
title: Getting Started
description: Enable access, create a workspace key, make your first request, and verify usage.
---

## Quickstart

<Steps>
  <Step>Ask an admin to explicitly enable Public API access for the target workspace.</Step>
  <Step>
    Create a workspace-scoped API key in Trendtrack — see{" "}
    <DocLink slug="authentication">Authentication</DocLink>.
  </Step>
  <Step>
    Call an unmetered shell endpoint like `GET /v1/me` to confirm the credential
    resolves to the expected workspace.
  </Step>
  <Step>
    Call `GET /v1/usage` to inspect the current credit balance before running
    any metered call.
  </Step>
  <Step>
    If freshness matters, call `GET /v1/system/freshness` before analytics
    queries so you know the current latest-ready date.
  </Step>
</Steps>

## Base URLs

Use an environment variable so scripts can switch base URLs without changing code:

```bash title="Shell"
export TT_API_BASE_URL="https://api.trendtrack.io"
```

## 30-second sanity check

Run this in a terminal — it authenticates, resolves your workspace, and returns real JSON in under a second. No credits are spent.

```bash title="Shell"
export TT_API_KEY="tt_live_…"
export TT_API_BASE_URL="https://api.trendtrack.io"
curl -s "$TT_API_BASE_URL/v1/workspace" \
  -H "Authorization: Bearer $TT_API_KEY" \
  -D - | head -20
```

```json title="Response (body)"
{
  "data": {
    "id": "ws_01HZX0W3YJABCDEF",
    "name": "Acme Growth",
    "plan": "professional",
    "createdAt": "2025-09-12T10:22:31.000Z"
  },
  "requestId": "req_01HZ…"
}
```

Relevant response headers returned by the `curl -D -` flag:

- `X-Request-Id` — quote this when reaching out to support.
- `X-Credits-Remaining` — sent by metered endpoints and by unmetered `GET /v1/usage`, which reports the current balance.

Shell endpoints (`/v1`, `/v1/health`, `/v1/me`, `/v1/workspace`, `/v1/usage`) are unmetered. They are the safest way to validate authentication, request IDs, and workspace resolution before moving on to metered business endpoints. `GET /v1/usage` still returns `X-Usage-Cost: 0`, `X-Credits-Used: 0`, and `X-Credits-Remaining`.

A successful response always carries `{ data, requestId }` (plus `pagination` on collection endpoints). Errors follow the same shape — always parse `error.code`, not the human message:

```json title="Error envelope"
{
  "error": {
    "code": "missing_api_key",
    "message": "Missing API key.",
    "requestId": "req_123"
  }
}
```

## Common first errors

- **`401 missing_api_key` / `401 invalid_api_key`**: header missing or malformed. Double-check `Authorization: Bearer <key>` (no `x-api-key`, no quotes around the value).
- **`401 credential_revoked` / `401 credential_expired`**: the key was deleted or rotated — issue a new one in workspace settings.
- **`403 workspace_public_api_disabled`**: Public API access has not been explicitly enabled for the workspace yet. A missing access row is treated as disabled.
- **`402 insufficient_credits`**: call `GET /v1/usage` to inspect the remaining balance, then top up or wait for the monthly refill.
- **`429 rate_limited`**: respect the `Retry-After` header before retrying. See <DocLink slug="rate-limits">Rate Limits</DocLink>.

Full list and status-code guidance lives in <DocLink slug="errors">Errors</DocLink>.

## Pagination pattern

Collection endpoints accept `limit` and `offset` (or a `page` parameter — check the operation page). Cost is charged per returned row, not per request, so always page conservatively:

```bash title="Paginated example"
curl -X GET "$TT_API_BASE_URL/v1/ads?search=skincare&limit=50&offset=0" \
  -H "Authorization: Bearer $TT_API_KEY"
```

`GET /v1/ads` always requires `search`. If you need advanced filters with no text term, use `POST /v1/ads/query` with a JSON body instead.

- Start with a small `limit` (10–50) while integrating to avoid burning credits on a loop bug.
- Watch the `X-Credits-Remaining` response header after every metered call.
- Stop paginating when the server returns fewer rows than `limit`.

## Track usage as you go

Metered responses can include:

- `X-Usage-Cost` — credits consumed by that request
- `X-Credits-Used` — credits consumed by that request
- `X-Credits-Remaining` — balance after the call
- `X-Credits-Source` — `recurring`, `topup`, or `hybrid` when a bucket is consumed
- `X-Request-Id` — include it when contacting support

`GET /v1/usage` is unmetered, but it still returns `X-Usage-Cost: 0`, `X-Credits-Used: 0`, and `X-Credits-Remaining`.

See <DocLink slug="credits-and-billing">Credits &amp; Billing</DocLink> for the complete consumption model.

## Agent integration path

For tracked-brand questions, resolve the workspace brandtracker first instead of searching the public ad library:

1. `GET /v1/me` — validate the key and workspace.
2. `GET /v1/usage` — check credit budget before metered loops.
3. `GET /v1/system/freshness` (optional) — read `latestReadyDate` and `dataFreshnessLagDays` before reporting historical, freshness-sensitive metrics.
4. `GET /v1/brandtrackers?page=1&limit=100` — match the user's brand name against `data[].name` and carry `data[].id` as `brandtrackerId`.
5. `GET /v1/brandtrackers/{brandtrackerId}/overview` — start with the overview for a broad read, then use canonical top-ads ranking calls when the user asks for winners or movers.
6. `GET /v1/brandtrackers/{brandtrackerId}/top-ads?sortBy=currentRank` — current ranking. Use `sortBy=rankDelta7d`, `rankDelta14d`, or `rankDelta30d` for rank movers, and `sortBy=reach`, `reachDelta1d`, `reachDelta7d`, or `reachDelta30d` for reach rankings.

Do not add `period` or `snapshotDate` to canonical top-ads ranking calls; they are deprecated compatibility parameters on `/top-ads`. `/scaling-ads` and `/ad-rank` are legacy compatibility endpoints for rank movers and may return an empty `trajectory` on the ES-backed path.

## Key concepts

A few field names worth knowing before browsing the reference:

- **`rank` / `currentRank`** — the current Facebook page rank returned on top-ads responses. Sort canonical ranking calls with `sortBy=currentRank`.
- **`rankDelta7d` / `rankDelta14d` / `rankDelta30d`** — canonical top-ads sort keys for rank movers. Use these instead of starting new integrations on `/scaling-ads` or `/ad-rank`.
- **`reach`** — the Meta Ad Library term for the public-facing impressions-style metric, exposed directly by our API. On brandtracker/top-ads GET endpoints, sort with `sortBy=reach`, `reachDelta1d`, `reachDelta7d`, or `reachDelta30d`; `impressions` is accepted as a reach alias. On `POST /v1/ads/query`, use `sortBy: "reach"` with `order`.
- **`daysRunning`** — number of calendar days an ad has been observed live. Useful as a longevity signal (winners typically stay live > 14 days).
- **`firstSeenAt`** — first timestamp at which Trendtrack observed the ad. Combined with `daysRunning`, it lets you reconstruct the live window.
- **`snapshotDate`** — an anchor date for historical/freshness-aware endpoints. It is deprecated and ignored on canonical `/top-ads` ranking calls. See <DocLink slug="time-windows">Time windows</DocLink> for where `period` and `snapshotDate` still apply.

## Next steps

<DocCardGrid>
  <DocCard slug="authentication" title="Authentication">
    Header format, key rotation, and what Trendtrack validates on every request.
  </DocCard>
  <DocCard slug="credits-and-billing" title="Credits &amp; Billing">
    Metered behavior, monthly refill, carry-over, and response headers.
  </DocCard>
  <DocCard slug="rate-limits" title="Rate Limits">
    Throttling behavior and `Retry-After` handling.
  </DocCard>
  <DocCard slug="errors" title="Errors">
    The stable error envelope and the full public error-code list.
  </DocCard>
  <DocCard slug="troubleshooting" title="Troubleshooting">
    Common failures, causes, and the fastest path to a working request.
  </DocCard>
  <DocCard slug="api-reference" title="API Reference">
    Resource-by-resource operation reference with request and response samples.
  </DocCard>
</DocCardGrid>
