import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { OpenRouterPrices } from "../../adapters/index.js";
import { Contracts, Primitives, Scope, type Brief, type Playbook, type ResearchRun, type ResearchStore, type TaskContract } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { DoneCheck } from "../done-check.js";
import type { LiveRuns } from "../live-runs.js";
import { PromptBlocks } from "../prompt/index.js";
import { CRITIC_INSTRUCTIONS, CRITIC_SYSTEM, WRITER_INSTRUCTIONS, WRITER_LIBRARY, WRITER_SYSTEM } from "../prompt/text/writer.js";
import type { RunAssembly } from "../run-assembly.js";
import { FinishTool, LibraryTools } from "../tools/index.js";
import { CountedTally } from "../task/counted-tally.js";
import { TaskCallLog } from "../task/task-call-log.js";
import type { TaskWork } from "../task/task-work.js";

import { RunError } from "../errors.js";
import { PlaybookShelf } from "../learning/playbook-shelf.js";

import { CriticTools } from "./critic-tools.js";
import { DraftDone, VerdictDone } from "./draft-done.js";
import { DraftRunAssembly } from "./draft-run-assembly.js";
import { WriterTools } from "./writer-tools.js";

/** A write or a critique task's work: the writer's or the critic's tools, a finish that checks the draft or its verdicts, and its prompts. Neither records findings, so a breaker closes nothing. */
export class DraftWorks {
  constructor(private readonly deps: { store: ResearchStore; runs: LiveRuns; costs: OpenRouterPrices }) {}

  async build(run: ResearchRun, contract: TaskContract, brief: Brief): Promise<TaskWork> {
    Trace.line(import.meta.url, "DraftWorks.build", { runId: run.id, primitive: contract.primitive });
    const { store, runs, costs } = this.deps;
    const runId = run.id;
    const agentId = Primitives.agent(contract);
    const check = DraftWorks.check(store, run, contract);
    const refused = (await store.listPacketChecks(runId)).filter((c) => !c.valid).length;
    const onChecked = async (valid: boolean, problems: readonly string[]): Promise<void> => {
      await store.addPacketCheck(runId, valid, problems);
      runs.emit(runId, "packet.checked", { agent_id: agentId, valid, problems: [...problems] });
    };
    const finish = new FinishTool(check, onChecked, new CountedTally(refused)).tool();
    const prompts = await this.prompts(run, contract, brief);
    return {
      runId,
      workspaceId: run.workspace_id,
      approved: true,
      contract,
      agentId,
      ceiling: Primitives.ceiling(contract),
      brief,
      tools: [...prompts.tools, finish],
      check,
      close: async () => ({ gapped: [], retracted: [] }),
      calls: new TaskCallLog(store, runId, agentId, costs),
      judgeCalls: new TaskCallLog(store, runId, "judge", costs),
      system: prompts.system,
      instructions: prompts.instructions,
      assembly: DraftWorks.assembly(store, run, contract, brief),
    };
  }

  private async prompts(run: ResearchRun, contract: TaskContract, brief: Brief): Promise<{ tools: AgentTool<any>[]; system: string; instructions: string }> {
    Trace.line(import.meta.url, "DraftWorks.prompts", { runId: run.id });
    const { store, runs } = this.deps;
    const draft = Contracts.draft(contract);
    if (draft) {
      const playbook = await DraftWorks.playbook(store, run, contract);
      if (!playbook) throw new RunError(`no playbook ${draft.playbook} in this workspace`);
      const writer = new WriterTools(store.drafts, store.findings, runs, { runId: run.id, workspaceId: run.workspace_id, playbook });
      const library = await LibraryTools.forWorkspace(store.library, run.workspace_id);
      const sections = playbook.sections.map((s) => `- \`${s.key}\` — ${s.title}: ${s.describe}`).join("\n");
      const readFirst = library ? `First read, in the library's "${playbook.document_title}": ${playbook.read_first.join(", ")}.\n\n` : "";
      return {
        tools: [writer.readInputs(), writer.writeSection(), ...(library ? [library.index(), library.read()] : [])],
        system: WRITER_SYSTEM.replace("{library}", library ? WRITER_LIBRARY : ""),
        instructions: [
          WRITER_INSTRUCTIONS.replace("{objective}", contract.objective).replace("{title}", playbook.title).replace("{sections}", sections).replace("{read_first}", readFirst),
          PromptBlocks.brief(brief),
        ].join("\n\n"),
      };
    }
    const verdict = Contracts.verdict(contract)!;
    const titles = new Map(((await DraftWorks.playbook(store, run, contract))?.sections ?? []).map((s) => [s.key, s.title]));
    const critic = new CriticTools(store.drafts, store.findings, runs, { runId: run.id, workspaceId: run.workspace_id, draftId: verdict.draft_id, criteria: verdict.criteria, titles });
    return {
      tools: [critic.readDraft(), critic.recordVerdict()],
      system: CRITIC_SYSTEM,
      instructions: CRITIC_INSTRUCTIONS.replace("{objective}", contract.objective).replace("{criteria}", verdict.criteria.map((c, i) => `${i + 1}. ${c}`).join("\n")),
    };
  }

  static check(store: ResearchStore, run: ResearchRun, contract: TaskContract): DoneCheck {
    Trace.line(import.meta.url, "DraftWorks.check", { runId: run.id });
    const draft = Contracts.draft(contract);
    if (draft) return new DraftDone(store.drafts, store.findings, { runId: run.id, playbook: () => DraftWorks.playbook(store, run, contract) });
    const verdict = Contracts.verdict(contract)!;
    return new VerdictDone(store.drafts, { workspaceId: run.workspace_id, draftId: verdict.draft_id, criteria: verdict.criteria });
  }

  /** The packet is the findings the draft rests on: the write task's own, or, for a critique, those of the task that wrote the draft. */
  static assembly(store: ResearchStore, run: ResearchRun, contract: TaskContract, brief: Brief): RunAssembly {
    Trace.line(import.meta.url, "DraftWorks.assembly", { runId: run.id });
    const source = () => DraftWorks.source(store, run, contract);
    return new DraftRunAssembly(store.findings, run.id, { source, brief, check: DraftWorks.check(store, run, contract) });
  }

  /** The playbook version a write task was started on, or the one the critiqued draft was written with. */
  static async playbook(store: ResearchStore, run: ResearchRun, contract: TaskContract): Promise<Playbook | null> {
    Trace.line(import.meta.url, "DraftWorks.playbook", { runId: run.id });
    const shelf = new PlaybookShelf(store);
    const draft = Contracts.draft(contract);
    if (draft) return draft.version ? shelf.at(run.workspace_id, draft.playbook, draft.version) : shelf.current(run.workspace_id, draft.playbook);
    const written = await store.drafts.get(Scope.of(run.workspace_id), Contracts.verdict(contract)!.draft_id);
    return written ? shelf.at(run.workspace_id, written.playbook, written.playbook_version) : null;
  }

  private static async source(store: ResearchStore, run: ResearchRun, contract: TaskContract): Promise<string> {
    Trace.line(import.meta.url, "DraftWorks.source", { runId: run.id });
    const verdict = Contracts.verdict(contract);
    if (!verdict) return run.id;
    return (await store.drafts.get(Scope.of(run.workspace_id), verdict.draft_id))?.run_id ?? run.id;
  }
}
