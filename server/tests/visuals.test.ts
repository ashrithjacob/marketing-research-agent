/** A brand's product shot and logo, read from its own page markup; addresses resolved against the page they came from. */
import { describe, expect, it } from "vitest";

import { PageVisuals } from "../src/adapters/index.js";

const base = "https://brand.example/products/drops";

describe("a page's visuals", () => {
  it("takes the og:image, resolving a protocol-relative address, and decodes &amp;", () => {
    expect(PageVisuals.meta('<meta property="og:image" content="//cdn.shopify.com/a.jpg?v=1&amp;w=2">', base)).toBe("https://cdn.shopify.com/a.jpg?v=1&w=2");
    expect(PageVisuals.meta('<meta name="twitter:image" content="/t.png">', base)).toBe("https://brand.example/t.png");
    expect(PageVisuals.meta("<title>none</title>", base)).toBeNull();
  });

  it("prefers the apple-touch-icon to a plain icon, and falls back to /favicon.ico", () => {
    const html = '<link rel="icon" href="/small.png"><link href="/big.png" rel="apple-touch-icon">';
    expect(PageVisuals.icon(html, base)).toBe("https://brand.example/big.png");
    expect(PageVisuals.icon('<link rel="shortcut icon" href="fav.png">', base)).toBe("https://brand.example/products/fav.png");
    expect(PageVisuals.icon("", base)).toBe("https://brand.example/favicon.ico");
  });
});
