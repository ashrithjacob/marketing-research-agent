import type { Pack } from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** A pack an agent reports must add up, and its servings count must appear on the page it cites. */
export class PackCheck {
  static readonly TOLERANCE = 0.1;

  static problems(pack: Pack | null, textOf: (url: string) => string): string[] {
    Trace.line(import.meta.url, "PackCheck.problems", { servings: pack?.servings_per_container ?? null });
    if (!pack) return [];
    return [...PackCheck.unprinted(pack, textOf(pack.source_url)), ...PackCheck.unbalanced(pack)];
  }

  private static unprinted(pack: Pack, text: string): string[] {
    Trace.line(import.meta.url, "PackCheck.unprinted");
    const servings = pack.servings_per_container;
    if (servings === null || !text) return [];
    const printed = new RegExp(`(^|[^\\d.,])${String(servings).replace(".", "\\.")}(?![\\d]|[.,]\\d)`).test(text);
    return printed ? [] : [`pack.servings_per_container ${servings} does not appear on ${pack.source_url}; copy it as the label prints it, or null`];
  }

  private static unbalanced(pack: Pack): string[] {
    Trace.line(import.meta.url, "PackCheck.unbalanced");
    const { net_contents: net, serving_size: serving, servings_per_container: servings } = pack;
    if (!net || !serving || servings === null) return [];
    if (PackCheck.unit(net.unit) !== PackCheck.unit(serving.unit)) return [];
    const implied = net.amount / serving.amount;
    if (Math.abs(implied - servings) / servings <= PackCheck.TOLERANCE) return [];
    return [`pack: net_contents ${net.amount} ${net.unit} / serving_size ${serving.amount} ${serving.unit} is ${Math.round(implied)} servings, but servings_per_container is ${servings}; read the label again`];
  }

  private static unit(unit: string): string {
    Trace.line(import.meta.url, "PackCheck.unit", { unit });
    return unit.toLowerCase().replace(/[\s.]/g, "");
  }
}
