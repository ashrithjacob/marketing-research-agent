import { Trace } from "../trace/index.js";

/** The words that identify a brand, and whether a page title or web address names them. */
export class BrandWords {
  static readonly GENERIC = new Set([
    "nutrition", "supplements", "supplement", "labs", "lab", "performance", "sports", "sport",
    "health", "wellness", "store", "brand", "the", "and", "pro", "com", "inc", "llc", "ltd", "co",
  ]);

  private constructor(readonly words: readonly string[]) {}

  static of(brand: string, ingredients: ReadonlySet<string>): BrandWords {
    Trace.line(import.meta.url, "BrandWords.of", { brand });
    const bare = brand.replace(/\([^)]*\)/g, " ");
    const words = BrandWords.split(bare).filter(
      (word) => word.length >= 3 && !BrandWords.GENERIC.has(word) && !ingredients.has(word),
    );
    return new BrandWords(words);
  }

  static split(text: string): string[] {
    Trace.tick(import.meta.url, "BrandWords.split", {});
    return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  }

  namedInTitle(title: string): boolean {
    Trace.line(import.meta.url, "BrandWords.namedInTitle", { words: this.words, title });
    const said = new Set(BrandWords.split(title));
    return this.words.some((word) => said.has(word));
  }

  namedInAddress(url: string): boolean {
    Trace.line(import.meta.url, "BrandWords.namedInAddress", { words: this.words, url });
    let host = "";
    try {
      host = new URL(url).hostname.toLowerCase().replace(/[^a-z0-9]/g, "");
    } catch {
      return false;
    }
    return this.words.some((word) => host.includes(word));
  }
}
