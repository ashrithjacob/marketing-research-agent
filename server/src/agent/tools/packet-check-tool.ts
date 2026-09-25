import type { AgentTool } from "@earendil-works/pi-agent-core";

import { EMPTY_LEDGER, type StagePacket } from "../../domain/index.js";
import { PacketDraft, PacketError, PacketValidator } from "../../extract/index.js";

import { PACKET_CHECK_BUDGET, type PacketCheckOptions } from "./lanes.js";
import { packetParameters } from "./parameters.js";

/** The contract as a tool: a shape error becomes a tool result, not a dead run. */
export class PacketCheckTool {
  constructor(private readonly check: PacketCheckOptions) {}

  tool(): AgentTool<typeof packetParameters> {
    const check = this.check;

      const most = { sources: 0, excerpts: 0, measurements: 0, competitors: 0 };
      let spent = 0;
      let passed = false;

      return {
        name: "validate_packet",
        label: "Check the packet",
        description:
          "Check a draft packet against the contract. Returns VALID, or the " +
          "exact problems to fix. Call it as soon as you have a few sources, and " +
          "again after each fix — a problem costs one call here and the whole run at " +
          "the end. The first packet that passes is this run's result; emit that same " +
          `packet as your final answer. ${PACKET_CHECK_BUDGET} checks per run.`,
        parameters: packetParameters,
        async execute(_id, params) {
          const coerced = PacketDraft.coerce(params.packet);
          if ("unparseable" in coerced) {
            return {
              content: [
                {
                  type: "text",
                  text:
                    "NOT CHECKED — the packet argument did not decode to one JSON " +
                    "object. Pass the packet itself: a JSON object, or one string " +
                    "containing exactly the packet's JSON and nothing else — not " +
                    "truncated, not wrapped in prose.",
                },
              ],
              details: { checked: false, reason: "not_a_packet_object" },
            };
          }
          const draft = coerced.draft;
          const count = (key: string) => (Array.isArray(draft[key]) ? (draft[key] as unknown[]).length : 0);
          const now = {
            sources: count("sources"),
            excerpts: count("excerpts"),
            measurements: count("measurements"),
            competitors: count("competitors"),
          };
          const shrunk = (Object.keys(most) as Array<keyof typeof most>).find(
            (key) => now[key] < most[key],
          );
          if (shrunk) {
            return {
              content: [
                {
                  type: "text",
                  text:
                    `NOT CHECKED — this draft has ${now[shrunk]} ${shrunk}; an earlier draft had ` +
                    `${most[shrunk]}. Fix the problem, do not drop the evidence. ` +
                    `Restore what is missing and call again.`,
                },
              ],
              details: { checked: false, reason: "evidence_shrank", field: shrunk },
            };
          }
          for (const key of Object.keys(most) as Array<keyof typeof most>) {
            most[key] = Math.max(most[key], now[key]);
          }

          if (spent >= PACKET_CHECK_BUDGET) {
            return {
              content: [
                {
                  type: "text",
                  text:
                    `NOT CHECKED — the ${PACKET_CHECK_BUDGET} checks for this run are spent. ` +
                    "Emit your best packet as your final answer now.",
                },
              ],
              details: { checked: false, reason: "budget_spent" },
            };
          }
          spent++;

          let packet: StagePacket | null = null;
          let problems: string[] = [];
          try {
            const ledger = check.reviews?.() ?? EMPTY_LEDGER;
            packet = new PacketValidator(ledger).validate(draft, check.nodes, check.brief);
          } catch (error) {
            problems =
              error instanceof PacketError
                ? error.message.split("; ")
                : [error instanceof Error ? error.message : String(error)];
          }
          check.onChecked?.(packet !== null, problems);

          if (packet) {
            if (!passed) {
              passed = true;
              check.onValid(packet);
            }
            return {
              content: [
                {
                  type: "text",
                  text:
                    "VALID — this packet is the run's result. Emit it as your final answer, " +
                    `unchanged, in one fenced json block.\nsources ${packet.sources.length} · ` +
                    `excerpts ${packet.excerpts.length} · measurements ${packet.measurements.length} · ` +
                    `gaps ${packet.gaps.length}`,
                },
              ],
              details: { checked: true, valid: true, checks_used: spent },
            };
          }

          const numbered = problems.map((problem, i) => `${i + 1}. ${problem}`).join("\n");
          return {
            content: [
              {
                type: "text",
                text:
                  `NOT VALID — ${problems.length} problem${problems.length === 1 ? "" : "s"}. ` +
                  `Fix exactly these and call again:\n${numbered}\n` +
                  `Checks used: ${spent} of ${PACKET_CHECK_BUDGET}.`,
              },
            ],
            details: { checked: true, valid: false, problems, checks_used: spent },
          };
        },
      };
  }
}
