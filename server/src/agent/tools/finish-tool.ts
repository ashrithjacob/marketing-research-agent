import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { StagePacket } from "../../domain/index.js";
import type { LedgerPacket } from "../ledger-packet.js";
import { FINISH_DESCRIPTION } from "../prompt/text/record-tools.js";
import { Trace } from "../../trace/index.js";

import { finishParameters } from "./parameters.js";

export const FINISH_BUDGET = 5;

export interface FinishHooks {
  onChecked: (valid: boolean, problems: readonly string[]) => void;
  onValid: (packet: StagePacket) => void;
}

/** Assembles the packet from the ledger and checks it; a pass ends the run, a failure hands back what to fix, at most FINISH_BUDGET times. */
export class FinishTool {
  private spent = 0;

  constructor(
    private readonly packet: LedgerPacket,
    private readonly hooks: FinishHooks,
  ) {}

  tool(): AgentTool<typeof finishParameters> {
    Trace.line(import.meta.url, "FinishTool.tool");
    const { packet, hooks } = this;
    const tool = this;
    return {
      name: "finish",
      label: "Finish",
      description: FINISH_DESCRIPTION,
      parameters: finishParameters,
      executionMode: "sequential",
      async execute() {
        Trace.line(import.meta.url, "FinishTool.tool.execute", { spent: tool.spent });
        if (tool.spent >= FINISH_BUDGET) {
          return {
            content: [
              {
                type: "text",
                text:
                  `NOT CHECKED — the ${FINISH_BUDGET} checks for this run are spent. The run ends ` +
                  "now and is settled from what the ledger holds.",
              },
            ],
            details: { checked: false, reason: "budget_spent" },
            terminate: true,
          };
        }
        tool.spent += 1;
        const result = packet.assemble();
        if ("packet" in result) {
          hooks.onChecked(true, []);
          hooks.onValid(result.packet);
          const p = result.packet;
          return {
            content: [
              {
                type: "text",
                text:
                  `FINISHED — the packet is assembled and valid: sources ${p.sources.length} · ` +
                  `excerpts ${p.excerpts.length} · measurements ${p.measurements.length} · ` +
                  `attributes ${p.attributes.length} · competitors ${p.competitors.length} · gaps ${p.gaps.length}.`,
              },
            ],
            details: { valid: true },
            terminate: true,
          };
        }
        hooks.onChecked(false, result.problems);
        const numbered = result.problems.map((problem, i) => `${i + 1}. ${problem}`).join("\n");
        return {
          content: [
            {
              type: "text",
              text:
                `NOT FINISHED — ${result.problems.length} problem${result.problems.length === 1 ? "" : "s"}. ` +
                `Fix them with record_* or retract, then call finish again:\n${numbered}\n` +
                `Checks used: ${tool.spent} of ${FINISH_BUDGET}.`,
            },
          ],
          details: { valid: false, problems: result.problems },
        };
      },
    };
  }
}
