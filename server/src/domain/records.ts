import { randomUUID } from "node:crypto";

import { Stages } from "./nodes.js";
import { Trace } from "../trace/index.js";

export class Clock {
  static nowIso(): string {
    Trace.tick(import.meta.url, "Clock.nowIso");
    return new Date().toISOString();
  }
}

export class Ids {
  static next(): string {
    Trace.line(import.meta.url, "Ids.next");
    return randomUUID().replace(/-/g, "");
  }
}

export interface ResearchRun {
  id: string;
  workspace_id: string;
  product_id: string;
  agent_run_id: string;
  session_id: string;
  stage: number;
  status: string;
  model: string;
  brief: Record<string, unknown>;
  reject_kinds: string[];
  judgement_ids: string[];
  nodes: string[];
  packet: Record<string, unknown> | null;
  packet_source: string;
  source_run_id: string;
  error: string;
  output: string;
  usage: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  ended_at: string;
}

export interface RunSummary {
  id: string;
  workspace_id: string;
  product_id: string;
  source_run_id: string;
  status: string;
  stage: number;
  model: string;
  brief: Record<string, unknown>;
  nodes: string[];
  error: string;
  created_at: string;
  updated_at: string;
  ended_at: string;
  usage: Record<string, unknown>;
  counts: {
    sources: number;
    rejected: number;
    excerpts: number;
    measurements: number;
    attributes: number;
    gaps: number;
    competitors: { direct: number; indirect_form: number; indirect_active: number };
  };
}

/** The shape the cockpit lists runs in: status plus what the packet holds. */
export class Runs {
  static summary(run: ResearchRun): RunSummary {
    Trace.line(import.meta.url, "Runs.summary", { run });
    const packet = (run.packet ?? {}) as Record<string, any>;
    const sources: any[] = packet.sources ?? [];
    return {
      id: run.id,
      workspace_id: run.workspace_id,
      product_id: run.product_id,
      source_run_id: run.source_run_id,
      status: run.status,
      stage: run.stage,
      model: run.model,
      brief: run.brief,
      nodes: Stages.expand(run.nodes),
      error: run.error,
      created_at: run.created_at,
      updated_at: run.updated_at,
      ended_at: run.ended_at,
      usage: run.usage,
      counts: {
        sources: sources.filter((s) => s.admitted ?? true).length,
        rejected: sources.filter((s) => !(s.admitted ?? true)).length,
        excerpts: (packet.excerpts ?? []).length,
        measurements: (packet.measurements ?? []).length,
        attributes: (packet.attributes ?? []).length,
        gaps: (packet.gaps ?? []).length,
        competitors: {
          direct: (packet.competitors ?? []).filter((c: any) => c.relation === "direct").length,
          indirect_form: (packet.competitors ?? []).filter((c: any) => c.relation === "indirect_form").length,
          indirect_active: (packet.competitors ?? []).filter((c: any) => c.relation === "indirect_active").length,
        },
      },
    };
  }
}
