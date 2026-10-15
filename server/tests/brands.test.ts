import { describe, expect, it } from "vitest";

import { HomepageImage } from "../src/adapters/index.js";
import { BrandPictureSearch } from "../src/agent/index.js";
import { Brands, type PagePicture, type ProductSummary, type ResearchStore } from "../src/domain/index.js";

const product = (key: string, label: string, latest_at: string): ProductSummary => ({ id: key, key, label, review_count: 0, created_at: latest_at, run_count: 1, latest_at, latest_status: "completed", default_run_id: "r" });

describe("Brands", () => {
  it("makes a site the brand of every page on it, and a named product its own brand", () => {
    expect(Brands.key({ url: "https://www.thedropletco.co.uk/products/scented-drops-1" })).toBe("site:thedropletco.co.uk");
    expect(Brands.key({ product: "thedropletco.co.uk" })).toBe("site:thedropletco.co.uk");
    expect(Brands.key({ product: "Nature Made Vitamin D3" })).toBe("product:naturemadevitamind3");
    expect(Brands.homepage("site:thedropletco.co.uk")).toBe("https://thedropletco.co.uk/");
    expect(Brands.homepage("product:creatine")).toBe("");
  });

  it("folds a site's pages into one tile, keeps a chat with no research yet, newest first", () => {
    const folders = Brands.folders(
      [product("page:thedropletco.co.uk", "https://thedropletco.co.uk", "2026-10-10"), product("page:thedropletco.co.uk/products/scented-drops-1", "https://thedropletco.co.uk/products/scented-drops-1", "2026-10-15"), product("product:creatine", "creatine", "2026-09-29")],
      [{ key: "product:magnesium", label: "Magnesium", created_at: "2026-10-16" }],
      [{ key: "site:thedropletco.co.uk", image_url: "https://thedropletco.co.uk/og.png", kind: "share", fetched_at: "2026-10-15" }],
    );
    expect(folders.map((f) => [f.key, f.label, f.image_url, f.products.length, f.latest_at])).toEqual([
      ["product:magnesium", "Magnesium", "", 0, "2026-10-16"],
      ["site:thedropletco.co.uk", "thedropletco.co.uk", "https://thedropletco.co.uk/og.png", 2, "2026-10-15"],
      ["product:creatine", "creatine", "", 1, "2026-09-29"],
    ]);
  });
});

describe("HomepageImage", () => {
  it("reads the share image, and the touch icon before the icon before /favicon.ico, as absolute URLs", () => {
    const base = "https://shop.example/";
    expect(HomepageImage.pick(`<link rel="icon" href="/i.png"><meta content='//cdn.example/og.jpg?a=1&amp;b=2' property='og:image'>`, base)).toEqual({ share: "https://cdn.example/og.jpg?a=1&b=2", icon: "https://shop.example/i.png" });
    expect(HomepageImage.pick(`<link rel="icon" href="/i.png"><link rel="apple-touch-icon" href="/touch.png">`, base)).toEqual({ share: "", icon: "https://shop.example/touch.png" });
    expect(HomepageImage.pick(`<link rel="icon" href="i.png">`, "https://shop.example/en/").icon).toBe("https://shop.example/en/i.png");
    expect(HomepageImage.pick("<html></html>", base)).toEqual({ share: "", icon: "https://shop.example/favicon.ico" });
    expect(HomepageImage.pick(`<meta property="og:image" content="javascript:alert(1)">`, base).share).toBe("");
  });

  it("fetches only public web hosts", () => {
    expect(HomepageImage.publicHost("https://thedropletco.co.uk/")).toBe(true);
    for (const url of ["http://localhost:8000/", "http://127.0.0.1/", "http://[::1]/", "http://172.28.0.1:8642/", "http://hermes/", "http://api.internal/", "file:///etc/passwd"]) expect(HomepageImage.publicHost(url)).toBe(false);
  });
});

describe("BrandPictureSearch", () => {
  const pages: Record<string, PagePicture> = {
    "https://healora.com/": { share: "", icon: "https://healora.com/favicon.ico" },
    "https://naturemade.com/products/d3": { share: "https://naturemade.com/d3.jpg", icon: "" },
    "https://naturemade.com/products/other": { share: "https://naturemade.com/other.jpg", icon: "" },
    "https://thallo.example/": { share: "", icon: "https://thallo.example/icon.png" },
  };
  const read: string[] = [];
  const finder = { read: async (page: string) => (read.push(page), pages[page] ?? { share: "", icon: "" }) };
  const store = (listings: Record<string, unknown[]>, sources: Record<string, unknown[]>) =>
    ({
      products: {
        runHeads: async () => [{ id: "r1", product_id: "p1", stage: 1, status: "completed", created_at: "" }],
        packetRows: async (id: string) => ({ sources: sources[id] ?? [] }),
      },
      listings: { list: async (runId: string) => listings[runId] ?? [] },
    }) as unknown as ResearchStore;

  it("takes a site's share image first, then a stored Amazon photo, then a product page's share image, then the site's icon", async () => {
    const amazon = { "r1": [{ target_id: "competitor-1", matches: true, listing: { thumbnail: "https://m.media-amazon.com/rival.jpg" } }, { target_id: "product", matches: true, listing: { thumbnail: "https://m.media-amazon.com/ours.jpg" } }] };
    expect(await new BrandPictureSearch(store(amazon, {}), finder).find("site:healora.com", [product("page:healora.com", "healora", "")].map((p) => ({ ...p, id: "p1" })))).toEqual({ image_url: "https://m.media-amazon.com/ours.jpg", kind: "thumbnail" });

    read.length = 0;
    const own = { p1: [{ kind: "competitor_marketing", node: "competitors", url: "https://rival.example/" }, { kind: "first_party", node: "competitors", url: "https://naturemade.com/products/other" }, { kind: "first_party", node: "product_data", url: "https://naturemade.com/products/d3.json" }, { kind: "first_party", node: "product_data", url: "https://naturemade.com/products/d3" }] };
    expect(await new BrandPictureSearch(store({}, own), finder).find("product:vitamind", [{ ...product("product:vitamind", "Vitamin D", ""), id: "p1" }])).toEqual({ image_url: "https://naturemade.com/d3.jpg", kind: "share" });
    expect(read).toEqual(["https://naturemade.com/products/d3"]);

    expect(await new BrandPictureSearch(store({}, {}), finder).find("site:thallo.example", [{ ...product("page:thallo.example", "thallo", ""), id: "p1" }])).toEqual({ image_url: "https://thallo.example/icon.png", kind: "icon" });
    expect(await new BrandPictureSearch(store({}, {}), finder).find("product:creatine", [])).toEqual({ image_url: "", kind: "" });
  });
});
