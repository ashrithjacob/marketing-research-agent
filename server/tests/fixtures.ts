import type { AssistantMessage, ToolCall } from "@earendil-works/pi-ai";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";

import { ServiceClients } from "../src/adapters/index.js";
import { Findings, type Finding, type FindingDraft, type FindingLedger, type PageFetcher } from "../src/domain/index.js";
import type { ActorRunner } from "../src/adapters/apify/index.js";
import type { Settings } from "../src/config/index.js";

/**
 * Packets that validate. Tests mutate one thing and assert the failure.
 *
 * Two of them, because review mining became stage 2 on 2026-09-21: a packet
 * belongs to one stage, and the validator rejects one that mixes them.
 */

/** Stage 1: the product, its competitors, its category. */
export function minimalPacket(overrides: Record<string, unknown> = {}): Record<string, any> {
  const data: Record<string, any> = {
    contract_version: "1",
    stage: 1,
    brief: { product: "MagnaCalm 400mg", url: "https://x", market: "UK" },
    sources: [
      {
        id: "sha256:aaa",
        url: "https://magnacalm.example/products/glycinate-400",
        kind: "first_party",
        publisher: "magnacalm.example",
        fetched_at: "2026-09-10T09:00:00Z",
        marketing: true,
        admitted: true,
        admission_reason: "first_party — the product's own page",
        archived: true,
        node: "product_data",
      },
    ],
    attributes: [
      {
        id: "a1",
        node: "product_data",
        key: "dose_per_serving",
        value: "400 mg",
        source_id: "sha256:aaa",
      },
    ],
    // product_data is the one node whose done-criterion is a checklist, so it
    // needs no saturation curve — which keeps this fixture minimal.
    nodes: [
      {
        node: "product_data",
        status: "complete",
        done_criterion_met: true,
        why: "9 of 10 attributes; COA gapped",
      },
    ],
    gaps: [
      {
        node: "product_data",
        missing: "no certificate of analysis published",
        would_need: "a batch COA on request",
        blocking: false,
      },
    ],
  };
  return { ...data, ...overrides };
}

/** Stage 2: verbatim customer language, with its 3★ excerpt. */
export function reviewPacket(overrides: Record<string, unknown> = {}): Record<string, any> {
  const data: Record<string, any> = {
    contract_version: "1",
    stage: 2,
    brief: { product: "MagnaCalm 400mg", url: "https://x", market: "UK" },
    sources: [
      {
        id: "sha256:aaa",
        url: "https://reddit.com/r/insomnia/1",
        kind: "forum",
        publisher: "reddit.com",
        fetched_at: "2026-09-10T09:00:00Z",
        admitted: true,
        admission_reason: "forum — default policy",
        archived: true,
        node: "review_mining",
      },
    ],
    excerpts: [
      {
        id: "sha256:bbb",
        source_id: "sha256:aaa",
        text: "I wake up at 3am and can't get back to sleep.",
        captured_at: "2026-09-10T09:00:01Z",
        node: "review_mining",
        star_rating: 3,
        axis: "why_quit",
        themes: ["3am waking"],
      },
    ],
    saturation: [
      {
        node: "review_mining",
        curve: [{ source_id: "sha256:aaa", new_themes: 1, cumulative_themes: 1 }],
        stopped_because: "three consecutive sources added no new theme",
      },
    ],
    nodes: [
      {
        node: "review_mining",
        status: "complete",
        done_criterion_met: true,
        why: "saturated",
      },
    ],
    gaps: [
      {
        node: "review_mining",
        missing: "no Trustpilot presence for this brand",
        would_need: "a merchant profile to exist",
        blocking: false,
      },
    ],
  };
  return { ...data, ...overrides };
}

const RECORDED_SECTIONS: ReadonlyArray<readonly [string, string]> = [
  ["sources", "record_source"],
  ["excerpts", "record_excerpt"],
  ["measurements", "record_measurement"],
  ["attributes", "record_attribute"],
  ["competitors", "record_competitor"],
  ["saturation", "record_saturation"],
  ["nodes", "record_node_status"],
  ["gaps", "record_gap"],
];

/** The record_* calls an agent makes to put a packet's rows in the ledger. */
export function recordCalls(packet: Record<string, any>): ToolCall[] {
  const calls: ToolCall[] = [];
  if (packet.competitor_reference) {
    calls.push(fauxToolCall("record_reference", { item: packet.competitor_reference }));
  }
  for (const [section, tool] of RECORDED_SECTIONS) {
    for (const item of packet[section] ?? []) calls.push(fauxToolCall(tool, { item }));
  }
  return calls;
}

/** A run that records `packet`, one turn of record_* calls, then calls finish. */
export function recorded(packet: Record<string, any>, options: { responseId?: string } = {}): AssistantMessage[] {
  return [
    fauxAssistantMessage(recordCalls(packet), { stopReason: "toolUse" }),
    fauxAssistantMessage(fauxToolCall("finish", {}), { stopReason: "toolUse", ...options }),
  ];
}

/** The shared service clients, with a stand-in Apify runner when a test needs one. */
export function services(settings: Settings, actors: ActorRunner | null = null, pages?: PageFetcher): ServiceClients {
  const real = ServiceClients.forSettings(settings);
  return new ServiceClients(pages ?? real.pages, real.search, actors);
}

/** The run ledger held in memory, for tests that need the port and not SQLite. */
export class MemoryLedger implements FindingLedger {
  readonly rows: Finding[] = [];

  append(draft: FindingDraft): Finding {
    const seq = this.rows.filter((row) => row.run_id === draft.run_id).length + 1;
    const row: Finding = {
      ...draft,
      seq,
      id: Findings.rowId(draft.kind, seq),
      created_at: "2026-09-29T00:00:00Z",
      retracted_at: "",
      retracted_why: "",
    };
    this.rows.push(row);
    return row;
  }

  retract(runId: string, id: string, why: string): Finding | null {
    const row = this.rows.find((r) => r.run_id === runId && r.id === id && r.retracted_at === "");
    if (!row) return null;
    row.retracted_at = "2026-09-29T00:00:01Z";
    row.retracted_why = why;
    return row;
  }

  list(runId: string): Finding[] {
    return this.rows.filter((row) => row.run_id === runId);
  }
}
