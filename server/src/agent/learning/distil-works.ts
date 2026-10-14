import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { OpenRouterPrices } from "../../adapters/index.js";
import { CheckProblems, Contracts, Primitives, Scope, type Brief, type CheckProblem, type ResearchRun, type ResearchStore, type TaskContract } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { DoneCheck } from "../done-check.js";
import { RunError } from "../errors.js";
import type { LiveRuns } from "../live-runs.js";
import { DISTILLER_INSTRUCTIONS, DISTILLER_SYSTEM } from "../prompt/text/writer.js";
import type { RunAssembly } from "../run-assembly.js";
import { CountedTally } from "../task/counted-tally.js";
import { TaskCallLog } from "../task/task-call-log.js";
import type { TaskWork } from "../task/task-work.js";
import { FinishTool, LibraryTools } from "../tools/index.js";
import { proposePlaybookParameters } from "../tools/parameters.js";
import { DraftRunAssembly } from "../write/draft-run-assembly.js";

import { LessonDesk } from "./lesson-desk.js";

/** A `distil` task's work (spec §5.8): an analyse worker reads one library document and proposes a playbook from it, which becomes a lesson card. Done when it has proposed one. */
export class DistilWorks {
  static readonly PROPOSED = "playbook.proposed";

  constructor(private readonly deps: { store: ResearchStore; runs: LiveRuns; costs: OpenRouterPrices }) {}

  async build(run: ResearchRun, contract: TaskContract, brief: Brief): Promise<TaskWork> {
    Trace.line(import.meta.url, "DistilWorks.build", { runId: run.id });
    const { store, runs, costs } = this.deps;
    const target = Contracts.playbook(contract)!;
    const library = await LibraryTools.forWorkspace(store.library, run.workspace_id);
    const document = (await store.library.list(Scope.of(run.workspace_id))).find((d) => d.id === target.document_id);
    if (!library || !document) throw new RunError(`library document ${target.document_id} is not ready`);
    const check = DistilWorks.check(store, run.id);
    const onChecked = async (valid: boolean, problems: readonly string[]): Promise<void> => {
      await store.addPacketCheck(run.id, valid, problems);
      runs.emit(run.id, "packet.checked", { agent_id: "analyse", valid, problems: [...problems] });
    };
    const refused = (await store.listPacketChecks(run.id)).filter((c) => !c.valid).length;
    return {
      runId: run.id,
      workspaceId: run.workspace_id,
      approved: true,
      contract,
      agentId: Primitives.agent(contract),
      ceiling: Primitives.ceiling(contract),
      brief,
      tools: [library.index(), library.read(), this.propose(run, target.document_id, document.title), new FinishTool(check, onChecked, new CountedTally(refused)).tool()],
      check,
      close: async () => ({ gapped: [], retracted: [] }),
      calls: new TaskCallLog(store, run.id, "analyse", costs),
      judgeCalls: new TaskCallLog(store, run.id, "judge", costs),
      system: DISTILLER_SYSTEM,
      instructions: DISTILLER_INSTRUCTIONS.replace("{objective}", contract.objective).replace("{title}", document.title).replace("{document_id}", document.id),
      assembly: DistilWorks.assembly(store, run, brief),
    };
  }

  private propose(run: ResearchRun, documentId: string, documentTitle: string): AgentTool<typeof proposePlaybookParameters> {
    Trace.line(import.meta.url, "DistilWorks.propose", { runId: run.id });
    const { store, runs } = this.deps;
    return {
      name: "propose_playbook",
      label: "Propose playbook",
      description: "Propose the playbook distilled from the document, for the owner to approve. Once per task.",
      parameters: proposePlaybookParameters,
      executionMode: "sequential",
      async execute(_id, params) {
        Trace.line(import.meta.url, "DistilWorks.propose.execute", { key: params.key });
        const playbook = { key: params.key, title: params.title, primitive: "write" as const, document_title: documentTitle, read_first: params.read_first, sections: params.sections, criteria: params.criteria };
        try {
          const lesson = await new LessonDesk(store).stage(run.workspace_id, { kind: "playbook_new", document_id: documentId, playbook }, params.why, []);
          runs.emit(run.id, DistilWorks.PROPOSED, { lesson_id: lesson.id, key: params.key });
          await runs.written(run.id);
          return { content: [{ type: "text", text: `PROPOSED — lesson ${lesson.id}; the owner decides on its card. Call finish.` }], details: { lesson_id: lesson.id } };
        } catch (error) {
          if (!(error instanceof RunError)) throw error;
          return { content: [{ type: "text", text: `REFUSED — ${error.message}` }], details: { refused: true } };
        }
      },
    };
  }

  static check(store: ResearchStore, runId: string): DoneCheck {
    Trace.line(import.meta.url, "DistilWorks.check", { runId });
    return {
      problems: async (): Promise<CheckProblem[]> => {
        Trace.line(import.meta.url, "DistilWorks.check.problems", { runId });
        const proposed = (await store.listEvents(runId)).some((e) => e.kind === DistilWorks.PROPOSED);
        return proposed ? [] : [CheckProblems.of("no playbook proposed yet; propose one with propose_playbook")];
      },
    };
  }

  static assembly(store: ResearchStore, run: ResearchRun, brief: Brief): RunAssembly {
    Trace.line(import.meta.url, "DistilWorks.assembly", { runId: run.id });
    return new DraftRunAssembly(store.findings, run.id, { source: async () => run.id, brief, check: DistilWorks.check(store, run.id) });
  }
}
