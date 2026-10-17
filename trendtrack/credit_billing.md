---
title: Credits & Billing
description: Understand how credits are consumed, how usage is exposed, and how top-ups behave.
---

## Credits model

- Public API billing is credits-only.
- One returned business resource or collection row costs one credit.
- Every active workspace plan includes 10,000 recurring credits per month.
- Top-up credits carry over and do not expire.

## Consumption order

1. Recurring monthly credits are consumed first.
2. Top-up carry-over credits are consumed second.

Metered collection endpoints use reservation and settlement in the backend, so the final cost is based on returned results rather than requested limits alone.

## Helpful endpoints and headers

- `GET /v1/usage` exposes the runtime balance snapshot. It is unmetered, but still returns `X-Usage-Cost: 0`, `X-Credits-Used: 0`, and `X-Credits-Remaining`.
- Successful metered responses can include `X-Usage-Cost`, `X-Credits-Used`, `X-Credits-Remaining`, and `X-Credits-Source`.
- Shell endpoints like `/v1/me`, `/v1/workspace`, `/v1/openapi.json`, and `/v1/docs` remain unmetered.

## Response headers explained

| Header                | Meaning                                                                              | Example value                  |
| --------------------- | ------------------------------------------------------------------------------------ | ------------------------------ |
| `X-Usage-Cost`        | Credits consumed by this specific request. `/v1/usage` returns `0`.                  | `12`                           |
| `X-Credits-Used`      | Credits consumed by this specific request. `/v1/usage` returns `0`.                  | `12`                           |
| `X-Credits-Remaining` | Balance after this request settled. Watch it to stop a loop before you run out.      | `9872`                         |
| `X-Credits-Source`    | Bucket the credits were drawn from on metered calls.                                 | `recurring`, `topup`, `hybrid` |
| `X-Request-Id`        | Stable per-request identifier echoed in error bodies. Quote when contacting support. | `req_01HZ…`                    |

Metering headers are emitted on metered endpoints. `GET /v1/usage` is the unmetered exception: it returns `X-Usage-Cost: 0`, `X-Credits-Used: 0`, and `X-Credits-Remaining` so agents can read the balance from headers as well as the body.

## Poll `/v1/usage` at session start

Long-running agents should call `/v1/usage` once when they boot to size their work against the remaining budget. It is unmetered, so there is no cost to calling it at every cold start. The response includes `X-Usage-Cost: 0`, `X-Credits-Used: 0`, and `X-Credits-Remaining`.

```bash title="Shell"
export TT_API_BASE_URL="https://api.trendtrack.io"
curl -s "$TT_API_BASE_URL/v1/usage" \
  -H "Authorization: Bearer $TT_API_KEY"
```

```json title="Response"
{
  "data": {
    "plan": "professional",
    "monthly": {
      "included": 10000,
      "remaining": 7240,
      "resetAt": "2026-05-01T00:00:00.000Z"
    },
    "topUp": { "remaining": 1500 },
    "total": { "remaining": 8740 }
  },
  "requestId": "req_01HZ…"
}
```

If `total.remaining` is below your worst-case job cost, stop and surface the budget gap to the caller instead of hitting `402 insufficient_credits` mid-loop.

## Top-ups

Manual and automatic top-ups are supported from the webapp billing layer. The fixed exchange rate is **$1 = 1,000 credits**, with a minimum top-up amount of **$10**.

## Force a docs cache refresh

When the API schema or guides change, the `/docs/llms.txt` and `/docs/llms-full.txt` endpoints are cached for 1 hour. Call `GET /docs/invalidate` to purge the cache immediately (provide the `DOCS_INVALIDATE_SECRET` in production via `Authorization: Bearer …` or `?secret=…`). This endpoint is a maintenance helper — it is not part of the public API surface.
