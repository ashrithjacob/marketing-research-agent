import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { configure, type Conversation, type ConversationId, type Extension } from "@earendil-works/pi-durable";

import { Runs, type ChatMessage, type ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { PiHarness } from "../pi-harness.js";
import type { TaskEvents } from "../task/task-events.js";
import type { TaskSupervisor } from "../task/task-supervisor.js";

import { ChatView } from "./chat-view.js";
import { OperatorIndex, WorkspaceDoc } from "./operator-docs.js";

/** Each workspace's operator: one long-lived conversation on the harness, created on first use. The owner's messages reach it ahead of other work; approvals and finished tasks are written into it as notes, which cost no model call. */
export class OperatorDesk {
  constructor(
    private readonly harness: PiHarness,
    private readonly store: ResearchStore,
    private readonly extension: Extension,
    private readonly model: string,
    private readonly tasks: TaskSupervisor,
    events: TaskEvents,
  ) {
    Trace.line(import.meta.url, "OperatorDesk.constructor", { model });
    harness.registry.install(extension);
    events.on((runId, status) => this.taskEnded(runId, status));
    events.onAsked((runId, question) => this.taskAsked(runId, question));
  }

  async say(workspaceId: string, text: string, planId: string): Promise<void> {
    Trace.line(import.meta.url, "OperatorDesk.say", { workspaceId, planId });
    const waiting = (await this.tasks.waiting(workspaceId)).map((w) => `[Task ${w.runId} is waiting for the owner's answer to: "${w.question}". If this message answers it, pass it on with answer_task.]`);
    const context = [...(planId ? [`[The owner has plan ${planId} open.]`] : []), ...waiting];
    const content = [...context, text].join("\n");
    const entry = { kind: "mra.owner", data: { text, plan_id: planId } };
    await (await this.conversation(workspaceId)).submit({ type: "input", content, whenBusy: "steer", entry }, BACKGROUND_CONTEXT);
  }

  async note(workspaceId: string, text: string): Promise<void> {
    Trace.line(import.meta.url, "OperatorDesk.note", { workspaceId });
    await (await this.conversation(workspaceId)).submit({ type: "write", entry: { kind: "mra.note", data: { text } } }, BACKGROUND_CONTEXT);
  }

  /** The chat as it stands, then again after every change, until the returned function is called. */
  async watch(workspaceId: string, listener: (chat: ChatMessage[]) => void): Promise<() => void> {
    Trace.line(import.meta.url, "OperatorDesk.watch", { workspaceId });
    const view = await (await this.conversation(workspaceId)).viewState(BACKGROUND_CONTEXT);
    listener(ChatView.of(view.value));
    const unsubscribe = view.subscribe((value) => listener(ChatView.of(value)));
    return () => {
      unsubscribe();
      view.dispose();
    };
  }

  private async taskEnded(runId: string, status: string): Promise<void> {
    Trace.line(import.meta.url, "OperatorDesk.taskEnded", { runId, status });
    const run = await this.store.getRun(runId);
    if (!run) return;
    const { counts, error } = Runs.summary(run);
    const objective = String(run.contract?.objective ?? runId);
    await this.note(run.workspace_id, `Task ${runId} ended ${status}: ${objective} — ${counts.sources} sources, ${counts.gaps} gaps${error ? `; ${error}` : ""}.`);
  }

  private async taskAsked(runId: string, question: string): Promise<void> {
    Trace.line(import.meta.url, "OperatorDesk.taskAsked", { runId });
    const run = await this.store.getRun(runId);
    if (!run) return;
    await this.note(run.workspace_id, `Task ${runId} is paused and asks: ${question} — answer here and it goes on.`);
  }

  private async conversation(workspaceId: string): Promise<Conversation> {
    Trace.line(import.meta.url, "OperatorDesk.conversation", { workspaceId });
    const session = this.harness.session;
    const root = await session.root(BACKGROUND_CONTEXT);
    const model = { provider: "openrouter", modelId: this.model };
    const extension = this.extension;
    const id: ConversationId = await root.commit(async (tx) => {
      const index = await tx.doc(OperatorIndex);
      const known = index.workspaces[workspaceId];
      if (known !== undefined) return known;
      const created = await tx.createConversation({ ownership: { kind: "ownerless" } });
      await configure(tx, created.id, { model, extensions: [extension] });
      (await tx.doc(WorkspaceDoc, created.id)).workspace_id = workspaceId;
      index.workspaces[workspaceId] = created.id;
      return created.id;
    }, BACKGROUND_CONTEXT);
    return (await session.conversation(id, BACKGROUND_CONTEXT))!;
  }
}
