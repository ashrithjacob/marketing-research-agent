---
title: Troubleshooting
description: Fast-path diagnosis for the most common Public API failures — authentication, billing, rate limits, and request shape.
---

Every API error returns the same envelope. Always parse `error.code`, not the human message:

```json title="Stable error envelope"
{
  "error": {
    "code": "missing_api_key",
    "message": "Missing API key.",
    "requestId": "req_123"
  }
}
```

If you need to contact support, include the `X-Request-Id` response header (or the `requestId` field) — it lets us correlate your call with backend logs instantly.

## 401 — Authentication failed

### `missing_api_key`

The `Authorization` header is missing or empty.

- Check that you are sending `Authorization: Bearer <key>` (not `x-api-key`, not `Api-Key`).
- Verify your HTTP client isn't stripping custom headers. Some CLIs need `--header` escaping.

### `invalid_api_key`

The header was present but Trendtrack could not resolve it to a key.

- Copy the key again from the workspace API settings — whitespace at either end breaks matching.
- Confirm your base URL is `https://api.trendtrack.io` unless your TrendTrack contact gives you a different origin; avoid preview URLs.

### `credential_not_found` / `credential_revoked` / `credential_expired`

The key resolved but is no longer usable.

- Rotate the key in Trendtrack → Workspace settings → API.
- If this happened unexpectedly, check whether another teammate revoked the key.

## 402 — `insufficient_credits`

The request was authenticated but the workspace does not have enough credits for the requested work.

- Call `GET /v1/usage` to see the remaining balance. It is unmetered but still returns `X-Usage-Cost: 0`, `X-Credits-Used: 0`, and `X-Credits-Remaining`; metered calls may report `X-Credits-Source` as `recurring`, `topup`, or `hybrid`.
- Top up from the webapp billing page. The fixed rate is `$1 = 1,000 credits`, minimum top-up `$10`.
- Remember: cost is charged per returned row, not per request. Paginating with a smaller `limit` reduces each call's cost.

## 403 — Workspace or permission denied

### `workspace_public_api_disabled` / `workspace_public_api_suspended`

The workspace itself cannot call the API right now.

- Ask an admin to explicitly enable Public API access in workspace settings. If no `workspace_public_api_access` row exists, TrendTrack treats the workspace as disabled.
- Contact support if the workspace was suspended.

### `forbidden`

The credential is valid but not allowed to reach this resource or action.

- Confirm the endpoint is exposed on the Public API (not every webapp endpoint is).
- Check workspace-level role requirements — some resources are admin-only.

## 404 — Not found

The path exists in the docs but the server does not have that record.

- Verify IDs (`adId`, `shopId`, etc.) — a trailing newline or wrong casing often masquerades as 404.
- For collection endpoints, 404 typically means the resource is not in your workspace's scope.

## 429 — `rate_limited`

You hit the public rate limit.

- Respect the `Retry-After` header before retrying.
- Back off exponentially if retries keep getting throttled.
- See <DocLink slug="rate-limits">Rate Limits</DocLink> for the full model.

## 500 — `internal_error`

Server-side failure. This one is on us.

- Include the `requestId` in any support message.
- If a retry with the exact same payload succeeds, the error was transient. If it keeps failing, reach out.

## Request shape surprises

- **`GET /v1/ads` fails or returns a validation error** — add the required `search` parameter, for example `/v1/ads?search=skincare&limit=25`. For advanced filters with no text term, use `POST /v1/ads/query`.
- **Advanced `/query` endpoint ignores your filters** — send `Content-Type: application/json` and put filters in the JSON request body. Query-string filters are for the lightweight GET endpoints only.
- **Empty collection returned but you expected results** — check that filters (`status`, `platform`, `mediaType`) are not narrower than intended. Start with the minimal query, then add filters one by one.
- **Fewer rows than `limit`** — that's the end of the collection for the current query. Stop paginating.
- **Response missing a field you saw before** — schema changes are additive. If a field disappears you think is stable, it likely was renamed or moved into a nested object. Check the <DocLink slug="api-reference">API Reference</DocLink> for the current shape.

## Still stuck?

- Keep <DocLink slug="errors">Errors</DocLink> open for the full code list.
- Capture the `X-Request-Id` and share it with support along with the exact URL and a sanitized copy of the request body.
