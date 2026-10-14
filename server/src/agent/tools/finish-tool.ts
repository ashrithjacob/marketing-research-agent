import type { AgentTool } from "@earendil-works/pi-agent-core";

import { CheckProblems, REFUSED_FINISH_LIMIT } from "../../domain/index.js";
import type { DoneCheck } from "../done-check.js";
import { FINISH_DESCRIPTION } from "../prompt/text/record-tools.js";
import { Trace } from "../../trace/index.js";

import { finishParameters } from "./parameters.js";

/** How many times this agent's finish has been refused; the refused-finish breaker reads the same count. */
export interface FinishTally {
  readonly refusedFinishes: number;
  refuse(): void;
}

/** Checks this agent's part of the ledger; a pass ends the agent, a failure hands back what to fix and counts toward the refused-finish breaker. */
export class FinishTool {
  constructor(
    private readonly check: DoneCheck,
    private readonly onChecked: (valid: boolean, problems: readonly string[]) => Promise<void>,
    private readonly tally: FinishTally,
  ) {}

  tool(): AgentTool<typeof finishParameters> {
    Trace.line(import.meta.url, "FinishTool.tool");
    const { check, onChecked, tally } = this;
    return {
      name: "finish",
      label: "Finish",
      description: FINISH_DESCRIPTION,
      parameters: finishParameters,
      executionMode: "sequential",
      async execute() {
        Trace.line(import.meta.url, "FinishTool.tool.execute", { refused: tally.refusedFinishes });
        if (tally.refusedFinishes >= REFUSED_FINISH_LIMIT) {
          return {
            content: [
              {
                type: "text",
                text: `NOT CHECKED — finish was refused ${REFUSED_FINISH_LIMIT} times. You end now, with what the ledger holds; what is still missing is recorded as gaps.`,
              },
            ],
            details: { checked: false, reason: "refused_finish" },
            terminate: true,
          };
        }
        const problems = CheckProblems.texts(await check.problems());
        await onChecked(problems.length === 0, problems);
        if (problems.length === 0) {
          return {
            content: [{ type: "text", text: "FINISHED — your part of the ledger passes its check. Your work is done." }],
            details: { valid: true },
            terminate: true,
          };
        }
        tally.refuse();
        const numbered = problems.map((problem, i) => `${i + 1}. ${problem}`).join("\n");
        return {
          content: [
            {
              type: "text",
              text:
                `NOT FINISHED — ${problems.length} problem${problems.length === 1 ? "" : "s"}. ` +
                `Fix them with record_* or retract, then call finish again:\n${numbered}\n` +
                `Refused ${tally.refusedFinishes} of ${REFUSED_FINISH_LIMIT}: at ${REFUSED_FINISH_LIMIT} you are stopped, and what is missing is recorded as gaps.`,
            },
          ],
          details: { valid: false, problems },
        };
      },
    };
  }
}
