import type { AgentTool } from "@earendil-works/pi-agent-core";

import { Corpus } from "../../adapters/corpus.js";
import type { OpenRouterPrices } from "../../adapters/index.js";
import type { Settings } from "../../config/index.js";
import { Briefs, DiscoveryQuestions, Primitives, RoleRecords, briefSchema, taskContractSchema, type Brief, type ResearchStore, type RoleSpec, type TaskContract, type Trip } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { DoneCheck } from "../done-check.js";
import { RunError } from "../errors.js";
import type { LimitClosed } from "../limit-close.js";
import type { LiveRuns } from "../live-runs.js";
import { PromptBuilder, StageOneBriefing, TaskBriefing, type RoleBriefing } from "../prompt/index.js";
import { RoleChecks } from "../role-checks.js";
import { RowRepair } from "../row-repair.js";
import type { RunAssembly } from "../run-assembly.js";
import { RunFindings } from "../run-findings.js";
import { RunMeter } from "../run-meter.js";
import { StageOneRunAssembly } from "../stage-one-run-assembly.js";
import { ExcerptTool, LedgerToolset, LibraryTools, NumberedPage, type ToolRegistry } from "../tools/index.js";

import { ChampionRunAssembly } from "./champion-run-assembly.js";
import { CountedTally } from "./counted-tally.js";
import { TaskCallLog } from "./task-call-log.js";

/** Everything one task's run needs in this process, built from its run row: its tools, its finish check, how it closes when a breaker trips, its prompts and its call log. */
export interface TaskWork {
  runId: string;
  workspaceId: string;
  approved: boolean;
  contract: TaskContract;
  role: RoleSpec;
  brief: Brief;
  tools: readonly AgentTool<any>[];
  check: DoneCheck;
  close: (trip: Trip) => Promise<LimitClosed>;
  calls: TaskCallLog;
  judgeCalls: TaskCallLog;
  system: string;
  instructions: string;
  assembly: RunAssembly;
}

export interface TaskWorkDeps {
  store: ResearchStore;
  runs: LiveRuns;
  settings: Settings;
  tools: ToolRegistry;
  costs: OpenRouterPrices;
}

/** Builds each task's work once per process and keeps it until the task ends; a restarted process builds it again from the store. */
export class TaskWorks {
  private readonly built = new Map<string, Promise<TaskWork>>();

  constructor(private readonly deps: TaskWorkDeps) {}

  of(runId: string): Promise<TaskWork> {
    Trace.line(import.meta.url, "TaskWorks.of", { runId });
    const known = this.built.get(runId);
    if (known) return known;
    const building = this.build(runId);
    this.built.set(runId, building);
    void building.catch(() => this.built.delete(runId));
    return building;
  }

  forget(runId: string): void {
    Trace.line(import.meta.url, "TaskWorks.forget", { runId });
    this.built.delete(runId);
  }

  private async build(runId: string): Promise<TaskWork> {
    Trace.line(import.meta.url, "TaskWorks.build", { runId });
    const { store, runs, settings, tools, costs } = this.deps;
    const run = await store.getRun(runId);
    if (!run?.contract) throw new RunError(`run ${runId} is not a task`);
    const contract = taskContractSchema.parse(run.contract);
    const brief = briefSchema.parse(run.brief);
    const role = Primitives.role(contract);
    const node = contract.complete.node ?? "competitors";
    const scope = { brief, nodes: [node], markets: Briefs.markets(brief) };
    const findings = new RunFindings(store.findings, runId, role.id, [node], scope.markets);
    const check = RoleChecks.done(role, findings, scope);
    const rows = await findings.rows();
    const refused = (await store.listPacketChecks(runId)).filter((c) => !c.valid).length;
    const research = tools.build(role.tools, {
      runId,
      subject: brief.product || brief.url,
      market: brief.market,
      discovery: DiscoveryQuestions.of(rows, brief),
      meter: new RunMeter(store, runs, runId, role.id),
      library: await LibraryTools.forWorkspace(store.library, run.workspace_id),
      view: new NumberedPage(),
    });
    const onChecked = async (valid: boolean, problems: readonly string[]): Promise<void> => {
      await store.addPacketCheck(runId, valid, problems);
      runs.emit(runId, "packet.checked", { agent_id: role.id, valid, problems: [...problems] });
    };
    const records = RoleRecords.of(role);
    const ledger = new LedgerToolset({ findings, records, check, onChecked, tally: new CountedTally(refused) }).build();
    const excerpts = records.includes("excerpt") ? [new ExcerptTool(findings, new Corpus(settings.corpusPath), node).tool()] : [];
    const briefing: RoleBriefing = contract.method
      ? new StageOneBriefing(new PromptBuilder(), { brief, nodes: [node], rejectKinds: [], judgements: [] })
      : new TaskBriefing(contract, brief);
    const closer = RoleChecks.closer(role, findings, new RowRepair(store.findings, runId, [node]), check, scope);
    return {
      runId,
      workspaceId: run.workspace_id,
      approved: (await store.listEvents(runId)).some((event) => event.kind === "run.approved"),
      contract,
      role,
      brief,
      tools: [...research.map((built) => built.tool), ...ledger, ...excerpts],
      check,
      close: closer ?? (async () => ({ gapped: [], retracted: [] })),
      calls: new TaskCallLog(store, runId, role.id, costs),
      judgeCalls: new TaskCallLog(store, runId, "judge", costs),
      system: briefing.system(role, research.map((built) => built.line).join("")),
      instructions: briefing.instructions(role, rows),
      assembly: TaskWorks.assembly(store, runId, contract, brief, role),
    };
  }

  /** How a task's run is assembled when it ends: a champion's reference on its own, any other task as a stage-1 run of its one node and its one role. */
  static assembly(store: ResearchStore, runId: string, contract: TaskContract, brief: Brief, role: RoleSpec): RunAssembly {
    Trace.line(import.meta.url, "TaskWorks.assembly", { runId, method: contract.method });
    if (contract.method === "champion") return new ChampionRunAssembly(store.findings, runId, brief);
    return new StageOneRunAssembly(store.findings, runId, { brief, nodes: Primitives.nodes(contract), roles: [role] });
  }
}
