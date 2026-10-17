---
title: Search by image
description: Find the products that look like a picture and the shops selling them, the most active advertisers first.
---

Two endpoints use the same visual search as the Trendtrack app:

- `POST /v1/products/image-search` returns the store products that look like an image, most similar first.
- `POST /v1/shops/image-search` returns the shops selling them, the most active advertisers (Meta active ads) first, each with its closest products.

## Send the image

Send exactly one of:

| Field      | How                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------- |
| `image`    | A file in `multipart/form-data`: JPEG, PNG or WEBP, 10 MB max. Larger files return `413`.   |
| `imageUrl` | A public `http(s)` URL in a JSON body. The server downloads it (10 MB max).                 |
| `searchId` | The `meta.searchId` of a previous answer, to read its next pages without sending the image. |

```bash title="Shops selling this product, from a file"
export TT_API_BASE_URL="https://api.trendtrack.io"
curl -s -X POST "$TT_API_BASE_URL/v1/shops/image-search" \
  -H "Authorization: Bearer $TT_API_KEY" \
  -F "image=@product.jpg" \
  -F "limit=10"
```

```bash title="Products that look like an image URL"
curl -s -X POST "$TT_API_BASE_URL/v1/products/image-search" \
  -H "Authorization: Bearer $TT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "https://cdn.shopify.com/s/files/1/0000/products/lamp.jpg", "limit": 10}'
```

## Read the next pages

Every first answer carries `meta.searchId`. Send it back with a higher `offset` and the same options: the image is not sent or computed again, and the results stay in the same order.

```bash title="Page 2"
curl -s -X POST "$TT_API_BASE_URL/v1/shops/image-search" \
  -H "Authorization: Bearer $TT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"searchId": "c97f4092-88a0-4f28-8fb7-57dac06ad1d8", "offset": 10, "limit": 10}'
```

A `searchId` belongs to the workspace of the key that created it; another workspace gets `404`.

## One shop, one row

A brand often sells the same product on several storefronts, and a shop often lists one product several times (variants, duplicate photos). The results count each of them once, so you never pay twice for the same shop:

- A product repeated in one shop is returned once.
- One Shopify store served on several domains is one shop.
- With `groupBrands` (default `true`), the storefronts of one brand (same name across countries and subdomains, such as `fridoorthotics.com` and `fridoorthotics.co.uk`) are one shop. The shop search returns its most active storefront as `shop` and the others in `otherStorefronts`. Set `groupBrands: false` to list every storefront.
- The product search returns one product per shop by default. Set `maxPerShop` (up to 10, `0` for no cap) to get more.
- The shop search returns, per shop, `matchingProducts` (distinct products that match) and its closest `products` (`productsPerShop`, 3 by default, up to 10). Each product price is in the currency of the storefront that sells it.

## Similarity and credits

`similarityScore` is the visual similarity between your image and the product photo, from `0.7` to `1`. Results below `0.7` are not returned.

Both endpoints cost 4 credits per row returned: a product for `/v1/products/image-search`, a shop for `/v1/shops/image-search`. Other storefronts and sample products of a shop are included in its row. A request that fails (unreadable image, `503` while the image search is unavailable) costs nothing.

## From Claude or ChatGPT

The MCP tools `search_products_by_image` and `search_shops_by_image` take `image_url` (or `search_id` for the next pages), plus `max_per_shop`, `group_brands` and `products_per_shop`. An image pasted in the conversation cannot be passed to a tool: give the assistant a link to the image.
