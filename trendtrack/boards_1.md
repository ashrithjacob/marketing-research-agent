---
title: Boards
description: Save ads, shops, emails, and advertisers into boards, organize them, and share them — the same boards your team sees in the app.
---

Boards are where Trendtrack users save what they find. The `/v1/boards` endpoints read and write the same boards as the web app and the browser extension: an item added through the API shows up in the app, and the reverse.

<Callout title="Favorites are now boards">
  The `/v1/favorites/*` endpoints are deprecated. They are a compatibility layer
  over boards: favorite folder ids are board ids, saved favorite ids are board
  item ids. New integrations should use `/v1/boards`.
</Callout>

## Collections and folders

Every board has a `kind`:

| Kind         | Holds                                                              | `surface`                                                                  |
| ------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `collection` | Any saved content, mixed. This is the default.                     | Always `null`.                                                             |
| `folder`     | One kind of content only, set by its `surface`.                    | Required: `ads`, `shops`, `landing`, `emails`, `products`, `advertisers`. |

Boards nest: a board's children have the same `kind` as their parent (collections in collections, folders in folders). A child also takes its parent's visibility. Breaking either rule returns `409 conflict` with `details.reason = "board_hierarchy_conflict"`.

Adding content to a folder of another surface — a shop into an `ads` folder — returns `409 conflict` with `details.reason = "surface_mismatch"` and the expected and actual surfaces.

## Who can see and change a board

`visibility` is `private` (its creator and the people it is shared with), `workspace` (the whole workspace), or `public` (readable by any Trendtrack user who has its id).

- **API keys** act for the workspace. They only reach `workspace` boards, and boards they create are `workspace` boards.
- **Delegated credentials** (a user connected through OAuth, for example in Claude or ChatGPT) act as that user. They create `private` boards by default and can list them with `scope=personal`.
- Workspace boards need a Business or Agency plan with team seats. Boards in general need a Pro, Business, or Agency plan; otherwise the API returns `403 product_entitlement_required`.
- Every write needs a credential allowed to change workspace content. Each board also returns `capabilities.canAddItems` and `capabilities.canManage` for the current credential: check them before writing.

## Save an item

```bash title="Find a board, then save an ad into it"
export TT_API_BASE_URL="https://api.trendtrack.io"
curl -s "$TT_API_BASE_URL/v1/boards?rootOnly=true&limit=100" \
  -H "Authorization: Bearer $TT_API_KEY"

curl -s -X POST "$TT_API_BASE_URL/v1/boards/$BOARD_ID/items" \
  -H "Authorization: Bearer $TT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sourceType": "meta_ad", "sourceId": "facebook_1089760056243476"}'
```

`sourceId` must be the id the matching endpoint returns:

| `sourceType`  | `sourceId`                                                          |
| ------------- | ------------------------------------------------------------------- |
| `meta_ad`     | Ad id from `/v1/ads*`: `facebook_<digits>` (bare digits accepted).  |
| `google_ad`   | `google_CR<digits>` (`CR<digits>` accepted).                        |
| `tiktok`      | `tiktok_<digits>` (bare digits accepted).                           |
| `shop`        | The shop UUID from `/v1/shops*`, not its domain.                    |
| `email`       | `email:<digits>` (the bare email number is accepted).               |
| `advertiser`  | The numeric Facebook page id.                                       |

Saving an item that is already in the board does not duplicate it: the response has `created: false` and costs no credit.

## Read a board

`GET /v1/boards/{boardId}/items` returns references (`source.sourceType`, `source.sourceId`, position, who added it), not the content itself. Fetch the details you need from the resource endpoints, for example `GET /v1/ads/{adId}` or `GET /v1/shops/{shopId}`.

## Organize and share

| Action                     | Endpoint                                           |
| -------------------------- | -------------------------------------------------- |
| Rename, describe, change visibility | `PATCH /v1/boards/{boardId}`              |
| Move under another board   | `PATCH /v1/boards/{boardId}/parent` with `{"parentBoardId": "..."}`; `null` moves it to the top level |
| Move an item               | `POST /v1/boards/{boardId}/items/{itemId}/move` with `targetBoardId` and an optional `position` |
| Remove an item             | `DELETE /v1/boards/{boardId}/items/{itemId}`       |
| Archive a board            | `DELETE /v1/boards/{boardId}` — archives the board and everything under it |
| Restore it                 | `POST /v1/boards/{boardId}/restore`; list archived boards with `state=archived` |
| Share it                   | `POST /v1/boards/{boardId}/share-links` — each call creates a new link |

Archiving is reversible; nothing is deleted.

## Credits

| Call                                   | Cost                                   |
| -------------------------------------- | -------------------------------------- |
| `GET /v1/boards`, `GET .../items`      | 1 credit per returned row              |
| `GET /v1/boards/{boardId}`             | 1 credit                               |
| Add an item                            | 1 credit, 0 when it was already there  |
| Remove an item                         | 1 credit, 0 when it was not there      |
| Any other write                        | 1 credit                               |
