import type { AgentTool } from "@earendil-works/pi-agent-core";

import { CheckProblems } from "../../domain/index.js";
import type { DoneCheck } from "../done-check.js";
import { FINISH_DESCRIPTION } from "../prompt/text/record-tools.js";
import { Trace } from "../../trace/index.js";

import { finishParameters } from "./parameters.js";

export const FINISH_BUDGET = 5;

/** Checks this agent's part of the ledger; a pass ends the agent, a failure hands back what to fix, at most FINISH_BUDGET times. */
export class FinishTool {
  private spent = 0;

  constructor(
    private readonly check: DoneCheck,
    private readonly onChecked: (valid: boolean, problems: readonly string[]) => Promise<void>,
  ) {}

  tool(): AgentTool<typeof finishParameters> {
    Trace.line(import.meta.url, "FinishTool.tool");
    const { check, onChecked } = this;
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
                text: `NOT CHECKED — your ${FINISH_BUDGET} checks are spent. You end now, with what the ledger holds.`,
              },
            ],
            details: { checked: false, reason: "budget_spent" },
            terminate: true,
          };
        }
        tool.spent += 1;
        const problems = CheckProblems.texts(await check.problems());
        await onChecked(problems.length === 0, problems);
        if (problems.length === 0) {
          return {
            content: [{ type: "text", text: "FINISHED — your part of the ledger passes its check. Your work is done." }],
            details: { valid: true },
            terminate: true,
          };
        }
        const numbered = problems.map((problem, i) => `${i + 1}. ${problem}`).join("\n");
        return {
          content: [
            {
              type: "text",
              text:
                `NOT FINISHED — ${problems.length} problem${problems.length === 1 ? "" : "s"}. ` +
                `Fix them with record_* or retract, then call finish again:\n${numbered}\n` +
                `Checks used: ${tool.spent} of ${FINISH_BUDGET}.`,
            },
          ],
          details: { valid: false, problems },
        };
      },
    };
  }
}
