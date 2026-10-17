---
title: Errors
description: Handle the stable public error envelope and the core status-code/error-code set.
---

## Stable error envelope

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Missing API key.",
    "requestId": "req_123"
  }
}
```

Expect a stable JSON envelope and use the error code for logic, not the human message alone.

## Common public error codes

- `missing_api_key`
- `invalid_api_key`
- `credential_not_found`
- `credential_revoked`
- `credential_expired`
- `workspace_public_api_disabled`
- `workspace_public_api_suspended`
- `forbidden`
- `rate_limited`
- `insufficient_credits`
- `internal_error`

## Status code guidance

- **401**: missing or invalid authentication
- **402**: insufficient credits for the requested work
- **403**: authenticated but not allowed
- **404**: the requested resource was not found
- **429**: rate limited; check `Retry-After`

## Error code reference

| `error.code` | HTTP | Retry? | What to do |
|---|---|---|---|
| `missing_api_key` | 401 | No | Set `Authorization: Bearer <key>` on the request. |
| `invalid_api_key` | 401 | No | Re-copy the key from workspace settings — watch for whitespace or `x-api-key` confusion. |
| `credential_not_found` | 401 | No | The key was deleted. Issue a new one. |
| `credential_revoked` | 401 | No | The key was rotated. Issue a new one. |
| `credential_expired` | 401 | No | Renew the key from workspace settings. |
| `workspace_public_api_disabled` | 403 | No | Public API access must be explicitly enabled for the workspace; a missing access row is treated as disabled. |
| `workspace_public_api_suspended` | 403 | No | Contact support — billing or compliance hold. |
| `forbidden` | 403 | No | The key does not have permission for that resource. Check scope. |
| `rate_limited` | 429 | Yes | Respect `Retry-After` then retry. See <DocLink slug="rate-limits">Rate Limits</DocLink>. |
| `insufficient_credits` | 402 | No | Top up or wait for the monthly refill. Don't retry blindly. |
| `internal_error` | 500 | Yes | Retry with backoff. Include `requestId` when reporting. |

## Worked example: `insufficient_credits`

```json title="Response body (402)"
{
  "error": {
    "code": "insufficient_credits",
    "message": "Not enough credits to complete this request.",
    "requestId": "req_01HZ…"
  }
}
```

On a 402, do not retry blindly. Call `GET /v1/usage` to read the current balance and the monthly refill date, then either top up or surface the gap to the caller. Agents that loop over many pages should check `X-Credits-Remaining` on successful metered calls and stop before the next request would fail.
