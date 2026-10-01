import {
  DAYS_PER_UNIT,
  type Churn,
  type Economics,
  type Margin,
  type Mechanism,
  type OperatorInput,
  type PricePoint,
  type Regimen,
} from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** Days of supply, the churn flag and the margins: arithmetic on what was recorded, never an estimate; pure. */
export class ProductEconomics {
  static of(regimen: Regimen | null, mechanisms: readonly Mechanism[], prices: readonly PricePoint[], operator: OperatorInput | null): Economics {
    Trace.line(import.meta.url, "ProductEconomics.of", { prices: prices.length, operator: operator !== null });
    const perDay = regimen?.servings_per_day ?? null;
    const perContainer = regimen?.servings_per_container ?? null;
    const days = perDay !== null && perContainer !== null ? Math.round((perContainer / perDay) * 10) / 10 : null;
    const daysWhy = days !== null ? `${perContainer} servings at ${perDay} a day` : perContainer === null ? "servings per container are not known" : "servings per day are not known";
    return {
      operator,
      days_of_supply: days,
      days_why: daysWhy,
      churn: ProductEconomics.churn(days, mechanisms),
      margins: prices.map((price) => ProductEconomics.margin(price, operator)),
    };
  }

  /** The bottle runs out before a carrier active is said to work: the customer stops before the product could have helped. */
  static churn(days: number | null, mechanisms: readonly Mechanism[]): Churn {
    Trace.line(import.meta.url, "ProductEconomics.churn", { days, mechanisms: mechanisms.length });
    const carriers = mechanisms
      .filter((m) => m.story_weight === "carrier")
      .map((m) => {
        const effect = m.time_to_effect ? m.time_to_effect.value * DAYS_PER_UNIT[m.time_to_effect.unit] : null;
        return { active: m.active, time_to_effect_days: effect, runs_out_first: effect !== null && days !== null ? days < effect : null };
      });
    if (carriers.length === 0) return { mismatch: null, why: "no active is recorded as carrying the story", carriers };
    if (days === null) return { mismatch: null, why: "days of supply are not known", carriers };
    const timed = carriers.filter((c) => c.runs_out_first !== null);
    if (timed.length === 0) return { mismatch: null, why: "no carrier active has a time to effect", carriers };
    const first = timed.filter((c) => c.runs_out_first);
    const why = first.length > 0
      ? `a container lasts ${days} days; ${first.map((c) => `${c.active} takes ${c.time_to_effect_days} days`).join(", ")}`
      : `a container lasts ${days} days, longer than every carrier's time to effect`;
    return { mismatch: first.length > 0, why, carriers };
  }

  /** Gross margin per unit at one price: (price per unit − landed cost) ÷ price per unit, only when both are in one currency. */
  static margin(price: PricePoint, operator: OperatorInput | null): Margin {
    Trace.line(import.meta.url, "ProductEconomics.margin", { label: price.label });
    const unitPrice = Math.round((price.amount / price.units) * 100) / 100;
    const base = { label: price.label, subscription: price.subscription, unit_price: unitPrice, currency: price.currency, source_id: price.source_id };
    const cost = operator?.landed_unit_cost ?? null;
    if (cost === null) return { ...base, margin: null, why: "no landed unit cost was entered" };
    const costCurrency = (operator?.currency ?? "").toUpperCase();
    if (costCurrency !== price.currency) return { ...base, margin: null, why: `the price is in ${price.currency} and the landed cost in ${costCurrency || "no stated currency"}` };
    const margin = Math.round(((unitPrice - cost) / unitPrice) * 1000) / 1000;
    return { ...base, margin, why: `(${unitPrice} − ${cost}) ÷ ${unitPrice}` };
  }
}
