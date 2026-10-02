import { COMPETITORS_DELIVERABLE, Findings, type Finding, type FindingKind } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { ListCheck } from "./list-check.js";
import { SharedActives } from "./shared-actives.js";

/** A row that names something another row or the brief already holds — the champion's actives, the formula's actives, the brief's markets — must name it as written there; checked when it is written, so a wrong pick is refused on the turn it is made. */
export class RowPicks {
  static problems(kind: FindingKind, payload: Record<string, unknown>, live: readonly Finding[], markets: readonly string[]): string[] {
    Trace.line(import.meta.url, "RowPicks.problems", { kind });
    switch (kind) {
      case "competitor":
        return RowPicks.competitor(payload, live);
      case "mechanism":
      case "dose_study":
        return RowPicks.active(kind, payload, live);
      case "claim_limit":
        return RowPicks.market(payload, markets);
      default:
        return [];
    }
  }

  private static competitor(payload: Record<string, unknown>, live: readonly Finding[]): string[] {
    Trace.line(import.meta.url, "RowPicks.competitor", { id: payload.id });
    const parts = ListCheck.parts(COMPETITORS_DELIVERABLE, payload);
    const champion = live.find((row) => row.kind === "competitor_reference");
    if (!champion) return parts;
    const actives = (champion.payload.actives as string[] | undefined) ?? [];
    const label = `competitor '${String(payload.name ?? payload.id)}'`;
    return [...SharedActives.problems(label, (payload.shared_actives as string[] | undefined) ?? [], actives), ...parts];
  }

  private static active(kind: FindingKind, payload: Record<string, unknown>, live: readonly Finding[]): string[] {
    Trace.line(import.meta.url, "RowPicks.active", { kind, active: payload.active });
    const actives = live.filter((row) => row.kind === "active").map((row) => row.payload);
    const picked = actives.find((a) => Findings.name(a.name) === Findings.name(payload.active));
    if (!picked) {
      const names = actives.map((a) => String(a.name)).join(", ") || "none yet — wait until the formula agent has recorded them";
      return [`'${String(payload.active)}' is not a recorded active; copy one name word for word from the formula's actives: ${names}`];
    }
    if (kind !== "dose_study" || picked.amount === null || payload.studied_daily_dose === null) return [];
    const ours = String(picked.unit ?? "").trim().toLowerCase();
    const theirs = String(payload.unit ?? "").trim().toLowerCase();
    if (ours === theirs) return [];
    return [`the studied dose is in '${String(payload.unit)}' but the label states ${String(picked.name)} in '${String(picked.unit)}' — convert the studied daily dose to ${String(picked.unit)} and record it in that unit`];
  }

  private static market(payload: Record<string, unknown>, markets: readonly string[]): string[] {
    Trace.line(import.meta.url, "RowPicks.market", { market: payload.market, markets });
    if (markets.some((market) => Findings.name(market) === Findings.name(payload.market))) return [];
    const named = markets.length > 0 ? markets.join(", ") : "none — the brief names no market, so record a gap instead";
    return [`'${String(payload.market)}' is not one of the brief's markets; copy one word for word: ${named}`];
  }
}
