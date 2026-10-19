import type { Price } from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** A price an agent reports must appear, as a price, on the page it cites: the cure for a model that rewrites $22.46 as 2246 (run 344caa7d, 2026-10-19). */
export class PriceCheck {
  static problems(price: Price | null, textOf: (url: string) => string, where: string): string[] {
    Trace.line(import.meta.url, "PriceCheck.problems", { where, amount: price?.amount ?? null });
    if (!price) return [];
    const text = textOf(price.source_url);
    if (!text) return [];
    return PriceCheck.shown(price.amount, text) ? [] : [`${where} ${price.amount} does not appear as a price on ${price.source_url}; copy the one-off price exactly as the page shows it, e.g. 29.95`];
  }

  static shown(amount: number, text: string): boolean {
    Trace.line(import.meta.url, "PriceCheck.shown", { amount });
    const cents = amount.toFixed(2);
    const [whole, fraction] = cents.split(".") as [string, string];
    const grouped = Number(whole).toLocaleString("en-US");
    const forms = [`${grouped}.${fraction}`, `${whole}.${fraction}`, `${whole},${fraction}`, `${grouped.replace(/,/g, ".")},${fraction}`];
    if (fraction === "00") forms.push(grouped, whole);
    return forms.some((form) => new RegExp(`(^|[^\\d.,])${form.replace(/[.]/g, "\\.")}(?![\\d]|[.,]\\d)`).test(text));
  }
}
