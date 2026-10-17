import type { OpenRouterPrices } from "../../adapters/index.js";
import type { Settings } from "../../config/index.js";
import { Scope, type AdInsights, type AdLibrary, type BrandImageFinder, type Card, type ResearchStore, type RunRequest } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { LiveRuns } from "../live-runs.js";
import type { PiHarness } from "../pi-harness.js";
import { TaskEvents } from "../task/task-events.js";
import { TaskSupervisor } from "../task/task-supervisor.js";
import type { ToolRegistry } from "../tools/index.js";

import { AlwaysOnDesk } from "../always/always-on-desk.js";
import { AlwaysOnTools } from "../always/always-on-tools.js";
import { ScheduleDesk } from "../always/schedule-desk.js";
import { WatchDesk } from "../watch/watch-desk.js";
import { WatchSet } from "../watch/watch-set.js";
import { PlaybookDesk } from "../learning/playbook-desk.js";
import { TaskCreation } from "../always/task-creation.js";
import { WorkspaceSpend } from "../always/workspace-spend.js";
import { LessonDesk } from "../learning/lesson-desk.js";
import { MemoryDesk } from "../learning/memory-desk.js";
import { Reviewer } from "../learning/reviewer.js";
import { DraftDesk } from "../write/draft-desk.js";
import { DraftFlow } from "../write/draft-flow.js";

import { BrandShelf } from "./brand-shelf.js";
import { CardDesk } from "./card-desk.js";
import { LibraryShelfTools } from "./library-shelf-tools.js";
import { OperatorDesk } from "./operator-desk.js";
import { OperatorTools } from "./operator-tools.js";
import { OwnerDesk } from "./owner-desk.js";
import { PlanDesk } from "./plan-desk.js";
import { PlanRelease } from "./plan-release.js";
import { PlanStages } from "./plan-stages.js";
import { RunControlTools, type StageRunControl } from "./run-control-tools.js";
import { StageBriefDesk } from "./stage-brief-desk.js";
import { StageTools } from "./stage-tools.js";
import { BrandResearch } from "./brand-research.js";
import { ChatStages } from "./chat-stages.js";
import { ChatReviews, type ReviewAnalysisStarter } from "./chat-reviews.js";
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
  readonly playbooks: PlaybookDesk;
  readonly watch: WatchDesk;
  readonly stages: PlanStages;
  readonly brands: BrandShelf;
  readonly briefs: StageBriefDesk;

  constructor(deps: { store: ResearchStore; runs: LiveRuns; settings: Settings; harness: PiHarness; tools: ToolRegistry; costs: OpenRouterPrices; ads: AdLibrary | null; insights: AdInsights | null; brandImages: BrandImageFinder; stageRuns: StageRunControl & { analyst: ReviewAnalysisStarter; isLive: (runId: string) => boolean }; start: (request: RunRequest, workspaceId: string) => Promise<string> }) {
    Trace.line(import.meta.url, "WorkspaceServices.constructor");
    const events = new TaskEvents();
    this.memory = new MemoryDesk(deps.store);
    this.tasks = new TaskSupervisor({ ...deps, events, memory: this.memory });
    const reply = (workspaceId: string, brand: string, text: string) => this.operator.say(workspaceId, brand, text);
    const decide = (lessonId: string, approved: boolean, text: string) => this.lessons.decide(lessonId, approved, text);
    this.draftDesk = new DraftDesk(deps.store);
    const settle = async (draftId: string, approved: boolean) => void (await (approved ? this.draftDesk.approve(draftId, Scope.everything) : this.draftDesk.reject(draftId, Scope.everything)));
    const stage = (planId: string, approved: boolean) => this.stages.decide(planId, approved);
    const brief = (card: Card, approved: boolean, text: string) => this.brief(card, approved, text);
    this.cards = new CardDesk(deps.store, deps.store.plans, this.tasks, { reply, lesson: decide, draft: settle, stage, brief }, events);
    const { apifyMaxReviews: reviewsPerBand, reviewReuseDays: reuseDays } = deps.settings;
    this.stages = new PlanStages({ store: deps.store, runs: deps.runs, start: deps.start, reviewsPerBand, reuseDays }, events);
    this.drafts = new DraftFlow(deps.store, this.tasks, { maxUsd: deps.settings.taskMaxUsd }, events);
    this.lessons = new LessonDesk(deps.store);
    this.reviewer = new Reviewer(deps.store, deps.harness, this.lessons, deps.settings.model);
    const plans = new PlanDesk(deps.store.plans, this.tasks, this.cards, deps.store.feedback);
    this.release = new PlanRelease(deps.store, deps.store.plans, plans, events);
    this.schedules = new ScheduleDesk(deps.store);
    const always = new AlwaysOnTools(new TaskCreation(this.tasks, plans), this.schedules);
    this.playbooks = new PlaybookDesk(deps.store, this.tasks, { maxUsd: deps.settings.taskMaxUsd });
    const chatStages = new ChatStages(deps.store, deps.store.plans, this.stages, deps.start);
    this.briefs = new StageBriefDesk(deps.store, plans, chatStages, (workspaceId, draft) => this.cards.open(workspaceId, draft));
    const research = new StageTools(new BrandResearch(deps.store), this.briefs, chatStages, new ChatReviews(deps.store, deps.stageRuns.analyst, deps.stageRuns.isLive));
    const tools = new OperatorTools(deps.store, plans, this.tasks, this.cards, this.memory, always, new RunControlTools(deps.store, this.tasks, deps.stageRuns), new LibraryShelfTools(deps.store.library, this.playbooks), research);
    this.operator = new OperatorDesk(deps.harness, deps.store, tools.extension(), deps.settings.model, this.tasks, events);
    this.brands = new BrandShelf(deps.store, this.operator, deps.brandImages);
    this.owner = new OwnerDesk(plans, this.operator, deps.store.feedback);
    this.board = new WorkspaceBoard(deps.store, this.tasks, () => this.alwaysOn);
    const signal = (workspaceId: string, text: string, key: string) => this.operator.signal(workspaceId, "", text, key);
    this.alwaysOn = new AlwaysOnDesk(deps.store, WatchSet.build({ ...deps, limits: this.tasks.limits }, signal), new WorkspaceSpend(deps.store));
    this.watch = new WatchDesk(deps.store);
  }

  /** A stage brief's card settled: approved, its stage runs with the text as approved and the brand's chat is told, so it can say so; set aside, the chat is told without a reply. */
  private async brief(card: Card, approved: boolean, text: string): Promise<void> {
    Trace.line(import.meta.url, "WorkspaceServices.brief", { cardId: card.id, approved });
    if (card.action.kind !== "stage_brief") return;
    const brand = card.action.brand;
    if (!approved) return this.operator.note(card.workspace_id, brand, `The owner set aside the brief "${card.title}".`);
    const started = await this.briefs.run(card.workspace_id, card.action, text);
    await this.operator.signal(card.workspace_id, brand, `The owner approved the brief "${card.title}"${text !== card.body.trim() ? " with changes" : ""}, and it started. ${started}`, `brief:${card.id}`);
  }
}
