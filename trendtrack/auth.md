---
title: Authentication
description: Authenticate every request with a workspace API key and verify the resolved workspace context.
---

## Authorization header

Authenticate every request with a workspace API key using the `Authorization` header.

```http
Authorization: Bearer <your_api_key>
```

## What Trendtrack validates

- Whether the API key is valid and active
- Whether the bound workspace currently has Public API access
- Whether the credential has been revoked or expired
- Workspace-level authorization and delegated user state

## Recommended verification flow

1. Create the key in the workspace API settings UI.
2. Call `GET /v1/me` to confirm the resolved credential and request flow.
3. Call `GET /v1/workspace` to verify the bound workspace context.
