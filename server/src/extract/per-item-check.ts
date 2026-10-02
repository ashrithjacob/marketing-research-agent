import { Findings, type Finding, type ItemNeed, type PerItemDeliverable } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { DeliverableCheck, Missing } from "./deliverable-check.js";
import { FieldsCheck } from "./fields-check.js";
import { LatestRows } from "./latest-rows.js";

interface Item {
  label: string;
  values: readonly string[];
}

/** What a `per_item` deliverable still lacks: for each item another agent or the brief lists, the first need with no matching row, or a matching row with its field unset, and no gap on any node whose `missing` starts with "<need>: <item>". */
export class PerItemCheck implements DeliverableCheck {
  constructor(
    private readonly deliverable: PerItemDeliverable,
    private readonly markets: readonly string[],
  ) {}

  missing(rows: readonly Finding[]): Missing[] {
    Trace.line(import.meta.url, "PerItemCheck.missing", { node: this.deliverable.node, rows: rows.length });
    const live = Findings.live(rows);
    const { over, needs } = this.deliverable;
    if (over.from === "markets" && this.markets.length === 0) {
      return needs.slice(0, 1).flatMap((need) => PerItemCheck.open(`${need.key}: market`, "the brief names no market", live));
    }
    const items = this.items(live).flatMap((item) => {
      const need = needs.find((n) => !PerItemCheck.met(n, item, live));
      return need ? PerItemCheck.open(`${need.key}: ${item.label}`, need.describe, live) : [];
    });
    return [...items, ...this.marked(live)];
  }

  private items(live: readonly Finding[]): Item[] {
    Trace.line(import.meta.url, "PerItemCheck.items");
    const { over } = this.deliverable;
    if (over.from === "markets") return this.markets.flatMap((market) => over.times.map((time) => ({ label: `${market} / ${time}`, values: [market, time] })));
    return LatestRows.payloads(live, over.kind)
      .filter((payload) => !over.only || (payload[over.only.present] !== null && payload[over.only.present] !== undefined && !payload[over.only.absent]))
      .map((payload) => ({ label: String(payload[over.by] ?? ""), values: [String(payload[over.by] ?? "")] }));
  }

  private static met(need: ItemNeed, item: Item, live: readonly Finding[]): boolean {
    Trace.line(import.meta.url, "PerItemCheck.met", { need: need.key, item: item.label });
    const row = LatestRows.payloads(live, need.record).find((payload) =>
      need.match.every((field, i) => Findings.name(payload[field]) === Findings.name(item.values[i])),
    );
    if (!row) return false;
    return !need.field || (row[need.field] !== null && row[need.field] !== undefined);
  }

  private marked(live: readonly Finding[]): Missing[] {
    Trace.line(import.meta.url, "PerItemCheck.marked");
    const mark = this.deliverable.oneMarked;
    if (!mark) return [];
    const rows = LatestRows.payloads(live, mark.record);
    if (rows.length === 0 || rows.some((row) => row[mark.field] === mark.value)) return [];
    return PerItemCheck.open(mark.key, mark.describe, live);
  }

  private static open(key: string, how: string, live: readonly Finding[]): Missing[] {
    Trace.line(import.meta.url, "PerItemCheck.open", { key });
    if (FieldsCheck.gapped(key, live)) return [];
    return [{ key, text: `\`${key}\` is neither recorded nor gapped — ${how}, or record_gap with missing "${key}: <why>"` }];
  }
}
