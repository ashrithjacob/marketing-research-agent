import {
  CONTRACT_VERSION,
  Findings,
  Stages,
  type Brief,
  type Finding,
  type FindingKind,
  type Node,
} from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { LatestRows } from "./latest-rows.js";
import { BuyerStages } from "./buyer-stages.js";
import { SophisticationStage } from "./sophistication-stage.js";
import type { PacketSection } from "./row-blame.js";

/** Builds the packet from the run ledger, the way ReviewAssembly builds its review half: the model never writes it. */
export class PacketAssembly {
  static readonly SECTIONS: Readonly<Record<string, PacketSection>> = {
    sources: { kind: "source", one: false },
    excerpts: { kind: "excerpt", one: false },
    measurements: { kind: "measurement", one: false },
    attributes: { kind: "attribute", one: false },
    competitor_reference: { kind: "competitor_reference", one: true },
    competitors: { kind: "competitor", one: false },
    saturation: { kind: "saturation", one: false },
    nodes: { kind: "node_status", one: false },
    gaps: { kind: "gap", one: false },
    ad_elements: { kind: "ad_elements", one: false },
    buyer_stages: { kind: "buyer_stage", one: false },
    quotes: { kind: "quote", one: false },
    identity_entries: { kind: "identity_entry", one: false },
    pain_profiles: { kind: "pain_profile", one: false },
    avatars: { kind: "avatar", one: false },
    awareness: { kind: "awareness", one: false },
  };

  private readonly live: readonly Finding[];

  constructor(rows: readonly Finding[]) {
    Trace.line(import.meta.url, "PacketAssembly.constructor", { rows: rows.length });
    this.live = Findings.live(rows);
  }

  draft(run: { runId: string; brief: Brief; nodes: readonly Node[] }): Record<string, unknown> {
    Trace.line(import.meta.url, "PacketAssembly.draft", { runId: run.runId });
    const reference = this.payloads("competitor_reference").at(-1) ?? null;
    const attributes = this.payloads("attribute");
    return {
      contract_version: CONTRACT_VERSION,
      stage: Stages.covering(run.nodes) ?? 1,
      run_id: run.runId,
      brief: { ...run.brief, product: PacketAssembly.product(run.brief, attributes, reference) },
      sources: this.payloads("source"),
      excerpts: this.payloads("excerpt"),
      measurements: this.payloads("measurement"),
      attributes,
      competitor_reference: reference,
      competitors: this.payloads("competitor"),
      saturation: this.payloads("saturation"),
      nodes: this.payloads("node_status"),
      gaps: this.payloads("gap"),
      ad_elements: this.payloads("ad_elements"),
      element_shares: SophisticationStage.shares(this.live).filter((share) => share.of > 0),
      buyer_stages: this.payloads("buyer_stage"),
      buyer_stage_shares: BuyerStages.shares(this.live).filter((share) => share.of > 0),
      quotes: this.payloads("quote"),
      identity_entries: this.payloads("identity_entry"),
      pain_profiles: this.payloads("pain_profile"),
      avatars: this.payloads("avatar"),
      awareness: this.payloads("awareness"),
    };
  }

  private payloads(kind: FindingKind): Record<string, unknown>[] {
    Trace.line(import.meta.url, "PacketAssembly.payloads", { kind });
    return LatestRows.payloads(this.live, kind);
  }

  /** A site brief names no product; the product's own `name` attribute, or the champion's name, does. */
  private static product(
    brief: Brief,
    attributes: readonly Record<string, unknown>[],
    reference: Record<string, unknown> | null,
  ): string {
    Trace.line(import.meta.url, "PacketAssembly.product", { product: brief.product });
    if (brief.product.trim()) return brief.product;
    const named = attributes.find((a) => a.node === "product_data" && a.key === "name");
    if (typeof named?.value === "string" && named.value.trim()) return named.value.trim();
    return typeof reference?.name === "string" ? reference.name : "";
  }
}
