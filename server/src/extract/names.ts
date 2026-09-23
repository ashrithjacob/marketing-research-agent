import type { CompetitorRelation } from "../domain/index.js";

const NON_BRAND = new Set(["www", "co", "com", "net", "org", "gov", "edu", "ac", "shop", "store"]);

/** Loose string matching, so an echoed brief need not be character-perfect. */
export class Names {
  static normalise(value: string): string {
    return value.toLowerCase().replace(/\s+/g, " ").trim();
  }

  static squash(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  static sameHost(a: string, b: string): boolean {
    const left = Names.hostOf(a);
    return left !== "" && left === Names.hostOf(b);
  }

  private static hostOf(value: string): string {
    try {
      const raw = value.trim();
      if (!raw) return "";
      const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
      return url.hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return "";
    }
  }
}

/** The brand-ish labels in a bare domain, for matching a packet against a site brief. */
export class BrandLabels {
  static of(brief: string): string[] | null {
    if (/\s/.test(brief)) return null;
    let host: string;
    try {
      host = new URL(/^[a-z][a-z0-9+.-]*:\/\//.test(brief) ? brief : `https://${brief}`).hostname;
    } catch {
      return null;
    }
    const parts = host.split(".");
    if (parts.length < 2) return null;
    const labels = parts.slice(0, -1).filter((label) => label.length > 1 && !NON_BRAND.has(label));
    return labels.length > 0 ? labels : null;
  }
}

/** Same form is direct, different form is indirect; two `other`s cannot be told apart. */
export class Relations {
  static expected(competitorForm: string, referenceForm: string): CompetitorRelation | null {
    if (competitorForm === "other" && referenceForm === "other") return null;
    return competitorForm === referenceForm ? "direct" : "indirect";
  }
}
