/** A brand's product shot and logo, read from its own page markup; addresses resolved against the page they came from. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CachedVisuals, PageVisuals } from "../src/adapters/index.js";

import { FakeVisuals } from "./fakes.js";
import { PostgresStores } from "./postgres-stores.js";

const base = "https://brand.example/products/drops";

describe("a page's visuals", () => {
  it("takes the og:image, resolving a protocol-relative address, and decodes &amp;", () => {
    expect(PageVisuals.meta('<meta property="og:image" content="//cdn.shopify.com/a.jpg?v=1&amp;w=2">', base)).toBe("https://cdn.shopify.com/a.jpg?v=1&w=2");
    expect(PageVisuals.meta('<meta name="twitter:image" content="/t.png">', base)).toBe("https://brand.example/t.png");
    expect(PageVisuals.meta("<title>none</title>", base)).toBeNull();
    expect(PageVisuals.meta('<img id="landingImage" data-old-hires="https://m.media-amazon.com/images/I/71x.jpg" src="x">', base)).toBe("https://m.media-amazon.com/images/I/71x.jpg");
  });

  it("prefers the apple-touch-icon to a plain icon, and falls back to /favicon.ico", () => {
    const html = '<link rel="icon" href="/small.png"><link href="/big.png" rel="apple-touch-icon">';
    expect(PageVisuals.icon(html, base)).toBe("https://brand.example/big.png");
    expect(PageVisuals.icon('<link rel="shortcut icon" href="fav.png">', base)).toBe("https://brand.example/products/fav.png");
    expect(PageVisuals.icon("", base)).toBe("https://brand.example/favicon.ico");
  });
});

describe("the visual cache", () => {
  let pg: PostgresStores;
  beforeAll(async () => {
    pg = await PostgresStores.start();
  });
  afterAll(async () => {
    await pg.stop();
  });

  it("reads a page once, then answers from the cache", async () => {
    const inner = new FakeVisuals();
    const cached = new CachedVisuals(inner, pg.store.visuals);
    expect(await cached.find("https://a.example/p")).toEqual({ image_url: "https://a.example/p#image", logo_url: null });
    expect(await cached.find("https://a.example/p")).toEqual({ image_url: "https://a.example/p#image", logo_url: null });
    expect(inner.asked).toEqual(["https://a.example/p"]);
  });

  it("reads again a page it holds only a logo for, so a better reader can find its product shot", async () => {
    await pg.store.visuals.put("https://b.example/p", { image_url: null, logo_url: "https://b.example/favicon.ico" });
    const inner = new FakeVisuals();
    expect((await new CachedVisuals(inner, pg.store.visuals).find("https://b.example/p")).image_url).toBe("https://b.example/p#image");
    expect(inner.asked).toEqual(["https://b.example/p"]);
  });
});
