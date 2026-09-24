import type { z } from "zod";

import {
  STAGE_NODES,
  Stages,
  stagePacketSchema,
  type Node,
  type StagePacket,
} from "../domain/index.js";

import { PacketExtractor } from "./blocks.js";
import { BriefCheck } from "./brief-check.js";
import { ChampionCheck } from "./champion-check.js";
import { CitationCheck } from "./citation-check.js";
import { CompetitorCheck } from "./competitor-check.js";
import { CompletenessCheck } from "./completeness-check.js";
import { PacketError } from "./errors.js";
import { ScopeCheck } from "./scope-check.js";
import type { PacketCheck, PacketContext } from "./check.js";

/** Turns a zod failure into something an agent can act on in one read. */
export class ZodProblems {
  static readable(error: z.ZodError): string {
    const all: string[] = [];
    for (const issue of error.issues) {
      const where = issue.path.join(".") || "(root)";
      if (issue.code === "unrecognized_keys") {
        for (const key of issue.keys) {
          all.push(
            `${where === "(root)" ? key : `${where}.${key}`}: field not in the stage-1 ` +
              "contract. Stage 1 gathers material and records nothing else — a " +
              "conclusion has no field to live in",
          );
        }
      } else {
        all.push(`${where}: ${issue.message}`);
      }
    }
    const lines = all.slice(0, 8);
    const remaining = all.length - lines.length;
    if (remaining > 0) lines.push(`(+${remaining} more)`);
    return lines.join("; ");
  }
}

/** Checks a packet against the contract, and reports every problem at once. */
export class PacketValidator {
  private readonly checks: readonly PacketCheck[] = [
    new ScopeCheck(),
    new BriefCheck(),
    new CitationCheck(),
    new CompletenessCheck(),
    new CompetitorCheck(),
    new ChampionCheck(),
  ];

  private readonly extractor = new PacketExtractor();

  validate(
    data: unknown,
    scope: readonly Node[] = STAGE_NODES[1],
    brief?: { product?: unknown; url?: unknown },
  ): StagePacket {
    const parsed = stagePacketSchema.safeParse(data);
    if (!parsed.success) throw new PacketError(ZodProblems.readable(parsed.error));
    const packet = parsed.data;

    const context: PacketContext = {
      scope,
      stage: Stages.covering(scope) ?? 1,
      sourceIds: new Set(packet.sources.map((source) => source.id)),
      brief,
    };
    const problems = this.checks.flatMap((check) => check.problems(packet, context));
    if (problems.length > 0) throw new PacketError(problems.join("; "));
    return packet;
  }

  parse(
    output: string,
    scope: readonly Node[] = STAGE_NODES[1],
    brief?: { product?: unknown; url?: unknown },
  ): StagePacket {
    return this.validate(this.extractor.extract(output), scope, brief);
  }
}
