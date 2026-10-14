import type { OpenRouterPrices } from "../../adapters/index.js";
import type { Settings } from "../../config/index.js";
import { Scope, type ResearchStore, type Schedule } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { LiveRuns } from "../live-runs.js";
import type { PiHarness } from "../pi-harness.js";
import { TaskEvents } from "../task/task-events.js";
import { TaskSupervisor } from "../task/task-supervisor.js";
import type { ToolRegistry } from "../tools/index.js";

import { AlwaysOnDesk } from "../always/always-on-desk.js";
import { AlwaysOnTools } from "../always/always-on-tools.js";
import { ScheduleDesk } from "../always/schedule-desk.js";
import { ScheduleWatchers } from "../always/schedule-watchers.js";
import { TaskCreation } from "../always/task-creation.js";
import { WorkspaceSpend } from "../always/workspace-spend.js";
import { LessonDesk } from "../learning/lesson-desk.js";
import { MemoryDesk } from "../learning/memory-desk.js";
import { Reviewer } from "../learning/reviewer.js";
import { DraftDesk } from "../write/draft-desk.js";
import { DraftFlow } from "../write/draft-flow.js";

import { CardDesk } from "./card-desk.js";
import { OperatorDesk } from "./operator-desk.js";
import { OperatorTools } from "./operator-tools.js";
import { OwnerDesk } from "./owner-desk.js";
import { PlanDesk } from "./plan-desk.js";
import { PlanRelease } from "./plan-release.js";
import { WorkspaceBoard } from "./workspace-board.js";

/** Everything that runs on the harness, built together: durable tasks, plans, each workspace's operator, and the board. */
export class WorkspaceServices {
  readonly tasks: TaskSupervisor;
  readonly operator: OperatorDesk;
  readonly owner: OwnerDesk;
  readonly board: WorkspaceBoard;
  readonly cards: CardDesk;
  readonly release: PlanRelease;
  readonly memory: MemoryDesk;
  readonly lessons: LessonDesk;
  readonly reviewer: Reviewer;
  readonly alwaysOn: AlwaysOnDesk;
  readonly schedules: ScheduleDesk;
  readonly drafts: DraftFlow;
  readonly draftDesk: DraftDesk;

  constructor(deps: { store: ResearchStore; runs: LiveRuns; settings: Settings; harness: PiHarness; tools: ToolRegistry; costs: OpenRouterPrices }) {
    Trace.line(import.meta.url, "WorkspaceServices.constructor");
    const events = new TaskEvents();
    this.memory = new MemoryDesk(deps.store);
    this.tasks = new TaskSupervisor({ ...deps, events, memory: this.memory });
    const reply = (workspaceId: string, text: string) => this.operator.say(workspaceId, text, "");
    const decide = (lessonId: string, approved: boolean, text: string) => this.lessons.decide(lessonId, approved, text);
    this.draftDesk = new DraftDesk(deps.store);
    const settle = async (draftId: string, approved: boolean) => void (await (approved ? this.draftDesk.approve(draftId, Scope.everything) : this.draftDesk.reject(draftId, Scope.everything)));
    this.cards = new CardDesk(deps.store, deps.store.plans, this.tasks, reply, decide, settle, events);
    this.drafts = new DraftFlow(deps.store, this.tasks, { maxUsd: deps.settings.taskMaxUsd }, events);
    this.lessons = new LessonDesk(deps.store, this.cards);
    this.reviewer = new Reviewer(deps.store, deps.harness, this.lessons, deps.settings.model);
    const plans = new PlanDesk(deps.store.plans, this.tasks, this.cards, deps.store.feedback);
    this.release = new PlanRelease(deps.store, deps.store.plans, plans, events);
    this.schedules = new ScheduleDesk(deps.store);
    const always = new AlwaysOnTools(new TaskCreation(this.tasks, plans), this.schedules);
    const tools = new OperatorTools(deps.store, plans, this.tasks, this.cards, this.memory, always);
    this.operator = new OperatorDesk(deps.harness, deps.store, tools.extension(), deps.settings.model, this.tasks, events);
    this.owner = new OwnerDesk(plans, this.operator);
    this.board = new WorkspaceBoard(deps.store, this.tasks, () => this.alwaysOn);
    const due = (workspaceId: string, schedule: Schedule, dueAt: string) =>
      this.operator.signal(workspaceId, `Scheduled: ${schedule.task_key} for ${schedule.brief.product || schedule.brief.url} is due (every ${schedule.every_days} days).`, `schedule:${schedule.id}:${dueAt.slice(0, 10)}`);
    this.alwaysOn = new AlwaysOnDesk(deps.store, new ScheduleWatchers(deps.store, deps.harness, due), new WorkspaceSpend(deps.store));
  }
}
