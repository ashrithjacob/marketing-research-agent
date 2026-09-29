import type { AmazonListing, MiningTarget } from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** Whether an Amazon listing is this target's product: its brand, one of its actives, and its form named in the title (a liquid by its volume, a powder by its weight). */
export class ListingMatch {
  static readonly FORM_WORDS: Readonly<Partial<Record<MiningTarget["form"], readonly string[]>>> = {
    capsule: ["capsule", "capsules", "caps", "softgel", "softgels"],
    tablet: ["tablet", "tablets", "tabs", "caplet", "caplets"],
    gummy: ["gummy", "gummies", "chews", "chewable", "chewables"],
    powder: ["powder"],
    liquid: ["liquid", "drops", "syrup", "tincture"],
    spray: ["spray"],
    tea: ["tea"],
  };

  static readonly AMOUNT_NAMES: Readonly<Partial<Record<MiningTarget["form"], RegExp>>> = {
    liquid: /(\d|\b)(ml|fl oz|oz|ounce|ounces)\b/,
    powder: /\d ?(g|gm|kg|lb|lbs)\b/,
  };

  static mismatch(target: MiningTarget, listing: AmazonListing): "" | "brand" | "active" | "form" {
    Trace.line(import.meta.url, "ListingMatch.mismatch", { target: target.id, brand: listing.brand });
    if (!ListingMatch.brandMatches(target, listing)) return "brand";
    if (!ListingMatch.activeNamed(target, listing.title)) return "active";
    return ListingMatch.formMatches(target, listing.title) ? "" : "form";
  }

  static formMatches(target: MiningTarget, title: string): boolean {
    Trace.line(import.meta.url, "ListingMatch.formMatches", { form: target.form, title });
    const words = ListingMatch.words(title);
    const says = (form: string) => (ListingMatch.FORM_WORDS[form as MiningTarget["form"]] ?? []).some((w) => words.includes(` ${w} `));
    if (!ListingMatch.FORM_WORDS[target.form]) {
      return !Object.keys(ListingMatch.FORM_WORDS).some((form) => says(form));
    }
    if (says(target.form)) return true;
    const amount = ListingMatch.AMOUNT_NAMES[target.form];
    return !!amount && amount.test(words) && !Object.keys(ListingMatch.FORM_WORDS).some((form) => says(form));
  }

  private static activeNamed(target: MiningTarget, title: string): boolean {
    Trace.line(import.meta.url, "ListingMatch.activeNamed", { target: target.id });
    const words = ListingMatch.words(title);
    return target.actives.some((active) =>
      ListingMatch.words(active).trim().split(" ").some((word) => word.length >= 4 && words.includes(` ${word} `)),
    );
  }

  private static brandMatches(target: MiningTarget, listing: AmazonListing): boolean {
    Trace.line(import.meta.url, "ListingMatch.brandMatches", { target: target.id, brand: listing.brand });
    if (listing.brand.trim() === "") return false;
    const brand = ListingMatch.words(listing.brand);
    const ours = ListingMatch.words(`${target.brand} ${target.name}`);
    const theirs = ListingMatch.words(`${listing.brand} ${listing.title}`);
    return ours.includes(brand) || (target.brand !== "" && theirs.includes(ListingMatch.words(target.brand)));
  }

  static words(text: string): string {
    Trace.tick(import.meta.url, "ListingMatch.words", {});
    return ` ${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
  }
}
