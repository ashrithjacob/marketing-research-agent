import type { AmazonListing, MiningTarget } from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** Whether an Amazon listing is this target's product: the same brand, and a title that names no other form. */
export class ListingMatch {
  static readonly FORM_WORDS: Readonly<Partial<Record<MiningTarget["form"], readonly string[]>>> = {
    capsule: ["capsule", "capsules", "caps", "softgel", "softgels"],
    tablet: ["tablet", "tablets", "tabs", "caplet", "caplets"],
    gummy: ["gummy", "gummies", "chews", "chewable", "chewables"],
    powder: ["powder"],
    liquid: ["liquid", "drops", "syrup"],
    spray: ["spray"],
    tea: ["tea"],
  };

  static mismatch(target: MiningTarget, listing: AmazonListing): string {
    Trace.line(import.meta.url, "ListingMatch.mismatch", { target: target.id, brand: listing.brand });
    if (!ListingMatch.brandMatches(target, listing)) return "brand";
    return ListingMatch.formMatches(target, listing.title) ? "" : "form";
  }

  static formMatches(target: MiningTarget, title: string): boolean {
    Trace.line(import.meta.url, "ListingMatch.formMatches", { form: target.form, title });
    const words = ListingMatch.words(title);
    const says = (form: string) => (ListingMatch.FORM_WORDS[form as MiningTarget["form"]] ?? []).some((w) => words.includes(` ${w} `));
    if (!ListingMatch.FORM_WORDS[target.form] || says(target.form)) return true;
    return !Object.keys(ListingMatch.FORM_WORDS).some((form) => form !== target.form && says(form));
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
