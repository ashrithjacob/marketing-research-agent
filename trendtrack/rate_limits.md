---
title: Rate Limits
description: Understand how Trendtrack rate limiting behaves and how clients should retry safely.
---

## Current behavior

Trendtrack owns authenticated public API rate limiting in the backend runtime. If a request is blocked, the API returns a canonical `429 rate_limited` response.

## Headers to watch

- `Retry-After` tells you when to retry after a `429`.
- `X-Request-Id` helps correlate support or debugging investigations.

## Implementation guidance

- Back off and retry after the interval in `Retry-After`.
- Treat rate limiting separately from billing failures such as `insufficient_credits`.
- Use the raw OpenAPI and Swagger references to verify per-endpoint behavior as the surface evolves.
