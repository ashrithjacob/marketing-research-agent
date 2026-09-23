import { randomUUID } from "node:crypto";

import { Stages } from "./nodes.js";

export class Clock {
  static nowIso(): string {
    return new Date().toISOString();
  }
}

export class Ids {
  static next(): string {
    return randomUUID().replace(/-/g, "");
  }
}

export interface ResearchRun {
  id: string;
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
  error: string;
  output: string;
  usage: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  ended_at: string;
}

export interface RunSummary {
  id: string;
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
    competitors: { direct: number; indirect: number };
  };
}

/** The shape the cockpit lists runs in: status plus what the packet holds. */
export class Runs {
  static summary(run: ResearchRun): RunSummary {
    const packet = (run.packet ?? {}) as Record<string, any>;
    const sources: any[] = packet.sources ?? [];
    return {
      id: run.id,
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
          indirect: (packet.competitors ?? []).filter((c: any) => c.relation === "indirect").length,
        },
      },
    };
  }
}
