import {
  CONTRACT_VERSION,
  Findings,
  RESEARCH_GUARD,
  type Active,
  type Brief,
  type DoseStudy,
  type Finding,
  type FindingKind,
  type Mechanism,
  type OperatorInput,
  type PricePoint,
  type Regimen,
} from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { DoseBands } from "./dose-bands.js";
import { LatestRows } from "./latest-rows.js";
import { ProductEconomics } from "./product-economics.js";
import type { PacketSection } from "./row-blame.js";

export interface NodeReport {
  node: string;
  status: "complete" | "incomplete";
  done_criterion_met: boolean;
  why: string;
}

/** Builds the product-truth packet from the ledger: the agents' rows as recorded, and every ratio, class, day count and margin computed here, never by a model. */
export class ProductTruthAssembly {
  static readonly SECTIONS: Readonly<Record<string, PacketSection>> = {
    sources: { kind: "source", one: false },
    actives: { kind: "active", one: false },
    regimen: { kind: "regimen", one: true },
    mechanisms: { kind: "mechanism", one: false },
    claim_limits: { kind: "claim_limit", one: false },
    prices: { kind: "price_point", one: false },
    gaps: { kind: "gap", one: false },
  };

  private readonly live: readonly Finding[];

  constructor(rows: readonly Finding[]) {
    Trace.line(import.meta.url, "ProductTruthAssembly.constructor", { rows: rows.length });
    this.live = Findings.live(rows);
  }

  draft(run: { runId: string; sourceRunId: string; brief: Brief; nodes: readonly NodeReport[] }): Record<string, unknown> {
    Trace.line(import.meta.url, "ProductTruthAssembly.draft", { runId: run.runId });
    const actives = this.rows<Active>("active");
    const regimen = this.rows<Regimen>("regimen").at(-1) ?? null;
    const mechanisms = this.rows<Mechanism>("mechanism");
    const studies = this.rows<DoseStudy>("dose_study");
    const prices = this.rows<PricePoint>("price_point");
    const operator = this.rows<OperatorInput>("operator_input").at(-1) ?? null;
    return {
      contract_version: CONTRACT_VERSION,
      stage: 2,
      run_id: run.runId,
      source_run_id: run.sourceRunId,
      brief: run.brief,
      guard: RESEARCH_GUARD,
      sources: this.payloads("source"),
      actives,
      regimen,
      mechanisms,
      doses: actives.map((active) => DoseBands.assess(active, regimen, studies.find((s) => Findings.name(s.active) === Findings.name(active.name)))),
      claim_limits: this.payloads("claim_limit"),
      prices,
      economics: ProductEconomics.of(regimen, mechanisms, prices, operator),
      nodes: [...run.nodes],
      gaps: this.payloads("gap"),
    };
  }

  private rows<T>(kind: FindingKind): T[] {
    Trace.line(import.meta.url, "ProductTruthAssembly.rows", { kind });
    return this.payloads(kind) as unknown as T[];
  }

  private payloads(kind: FindingKind): Record<string, unknown>[] {
    Trace.line(import.meta.url, "ProductTruthAssembly.payloads", { kind });
    return LatestRows.payloads(this.live, kind);
  }
}
