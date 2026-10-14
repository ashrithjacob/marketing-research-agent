import type { OpenRouterPrices } from "../../adapters/index.js";
import type { Settings } from "../../config/index.js";
import type { ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { LiveRuns } from "../live-runs.js";
import type { PiHarness } from "../pi-harness.js";
import { TaskEvents } from "../task/task-events.js";
import { TaskSupervisor } from "../task/task-supervisor.js";
import type { ToolRegistry } from "../tools/index.js";

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

  constructor(deps: { store: ResearchStore; runs: LiveRuns; settings: Settings; harness: PiHarness; tools: ToolRegistry; costs: OpenRouterPrices }) {
    Trace.line(import.meta.url, "WorkspaceServices.constructor");
    const events = new TaskEvents();
    this.tasks = new TaskSupervisor({ ...deps, events });
    this.cards = new CardDesk(deps.store, deps.store.plans, this.tasks, (workspaceId, text) => this.operator.say(workspaceId, text, ""), events);
    const plans = new PlanDesk(deps.store.plans, this.tasks, this.cards);
    this.release = new PlanRelease(deps.store, deps.store.plans, plans, events);
    const tools = new OperatorTools(deps.store, plans, this.tasks, this.cards);
    this.operator = new OperatorDesk(deps.harness, deps.store, tools.extension(), deps.settings.model, this.tasks, events);
    this.owner = new OwnerDesk(plans, this.operator);
    this.board = new WorkspaceBoard(deps.store, this.tasks);
  }
}
