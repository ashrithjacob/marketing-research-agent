import {
  AD_PLATFORMS,
  Findings,
  PRODUCT_TRUTH_AGENT_SPECS,
  type Active,
  type Finding,
  type FindingKind,
  type Node,
  type ProductTruthAgent,
} from "../domain/index.js";
import { Trace } from "../trace/index.js";

export interface OpenItem {
  node: Node;
  key: string;
  text: string;
}

interface Item {
  key: string;
  filled: boolean;
  record: string;
}

/** What each product-truth agent must leave recorded or gapped, read off the live ledger: a gap, on any node, closes an item when its `missing` starts with the item's key. */
export class ProductTruthCoverage {
  private readonly live: readonly Finding[];

  constructor(rows: readonly Finding[], private readonly markets: readonly string[]) {
    Trace.line(import.meta.url, "ProductTruthCoverage.constructor", { rows: rows.length, markets });
    this.live = Findings.live(rows);
  }

  open(agent: ProductTruthAgent): OpenItem[] {
    Trace.line(import.meta.url, "ProductTruthCoverage.open", { agent });
    const node = PRODUCT_TRUTH_AGENT_SPECS[agent].node;
    return this.items(agent)
      .filter((item) => !item.filled && !this.gapped(item.key))
      .map((item) => ({
        node,
        key: item.key,
        text: `\`${item.key}\` is neither recorded nor gapped — ${item.record}, or record_gap with missing "${item.key}: <why>"`,
      }));
  }

  actives(): Active[] {
    Trace.line(import.meta.url, "ProductTruthCoverage.actives");
    return this.payloads("active") as unknown as Active[];
  }

  private items(agent: ProductTruthAgent): Item[] {
    Trace.line(import.meta.url, "ProductTruthCoverage.items", { agent });
    switch (agent) {
      case "formula":
        return this.formula();
      case "mechanism":
        return this.mechanism();
      case "dose_vs_study":
        return this.actives()
          .filter((a) => a.amount !== null && !a.in_blend)
          .map((a) => ({ key: `dose: ${a.name}`, filled: this.has("dose_study", "active", a.name), record: "record its studied dose with record_dose_study" }));
      case "claim_limits":
        return this.claims();
      case "cogs_refills":
        return [{ key: "prices", filled: this.payloads("price_point").length > 0, record: "record each price with record_price" }];
    }
  }

  private formula(): Item[] {
    Trace.line(import.meta.url, "ProductTruthCoverage.formula");
    const regimen = this.payloads("regimen").at(-1);
    return [
      { key: "actives", filled: this.actives().length > 0, record: "record each active with record_active" },
      { key: "servings_per_day", filled: typeof regimen?.servings_per_day === "number", record: "record it with record_regimen" },
      { key: "servings_per_container", filled: typeof regimen?.servings_per_container === "number", record: "record it with record_regimen" },
    ];
  }

  private mechanism(): Item[] {
    Trace.line(import.meta.url, "ProductTruthCoverage.mechanism");
    const rows = this.payloads("mechanism");
    const items = this.actives().flatMap((a): Item[] => {
      const row = rows.find((r) => Findings.name(r.active) === Findings.name(a.name));
      if (!row) return [{ key: `mechanism: ${a.name}`, filled: false, record: "record it with record_mechanism" }];
      return [{ key: `time_to_effect: ${a.name}`, filled: row.time_to_effect !== null, record: "record it on its mechanism row" }];
    });
    const carrier = rows.length === 0 || rows.some((r) => r.story_weight === "carrier");
    return [...items, { key: "carrier", filled: carrier, record: "mark the active the product's story rests on as story_weight \"carrier\"" }];
  }

  private claims(): Item[] {
    Trace.line(import.meta.url, "ProductTruthCoverage.claims", { markets: this.markets });
    if (this.markets.length === 0) return [{ key: "claims: market", filled: false, record: "the brief names no market" }];
    return this.markets.flatMap((market) =>
      AD_PLATFORMS.map((platform) => ({
        key: `claims: ${market} / ${platform}`,
        filled: this.payloads("claim_limit").some((r) => Findings.name(r.market) === Findings.name(market) && r.platform === platform),
        record: "record its permitted and forbidden claims with record_claim_limits",
      })),
    );
  }

  private has(kind: FindingKind, field: string, name: string): boolean {
    Trace.line(import.meta.url, "ProductTruthCoverage.has", { kind, field, name });
    return this.payloads(kind).some((row) => Findings.name(row[field]) === Findings.name(name));
  }

  private gapped(key: string): boolean {
    Trace.line(import.meta.url, "ProductTruthCoverage.gapped", { key });
    const wanted = key.toLowerCase();
    return this.payloads("gap").some((gap) => String(gap.missing ?? "").trim().toLowerCase().startsWith(wanted));
  }

  private payloads(kind: FindingKind): Record<string, unknown>[] {
    Trace.line(import.meta.url, "ProductTruthCoverage.payloads", { kind });
    return this.live.filter((row) => row.kind === kind).map((row) => row.payload);
  }
}
