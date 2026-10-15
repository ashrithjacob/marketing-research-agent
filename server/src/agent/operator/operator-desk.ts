import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { configure, type Conversation, type ConversationId, type Extension } from "@earendil-works/pi-durable";

import { Brands, Clock, Runs, type BrandChat, type ChatMessage, type ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { PiHarness } from "../pi-harness.js";
import type { TaskEvents } from "../task/task-events.js";
import type { TaskSupervisor } from "../task/task-supervisor.js";

import { ChatView } from "./chat-view.js";
import { BrandChatIndex, BrandDoc, OperatorIndex, WorkspaceDoc } from "./operator-docs.js";

/** The operator: one long-lived conversation per brand of a workspace, created on first use, and one for the workspace itself that takes what belongs to no brand. The owner's messages reach it ahead of other work; a finished task is a signal to its brand's chat; approvals are notes, which cost no model call. */
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
  }

  async say(workspaceId: string, brand: string, text: string, label = ""): Promise<void> {
    Trace.line(import.meta.url, "OperatorDesk.say", { workspaceId, brand });
    const waiting = (await this.tasks.waiting(workspaceId)).map((w) => `[Task ${w.runId} is waiting for the owner's answer to: "${w.question}". If this message answers it, pass it on with answer_task.]`);
    const content = [...waiting, text].join("\n");
    const entry = { kind: "mra.owner", data: { text } };
    await (await this.conversation(workspaceId, brand, label)).submit({ type: "input", content, whenBusy: "steer", entry }, BACKGROUND_CONTEXT);
  }

  /** Something code noticed, for the operator to act on (spec §7.2): a follow-up, so it never interrupts the owner's turn; several arriving together become one run; the same `key` twice adds it once. */
  async signal(workspaceId: string, brand: string, text: string, key: string): Promise<void> {
    Trace.line(import.meta.url, "OperatorDesk.signal", { workspaceId, brand, key });
    const entry = { kind: "mra.signal", data: { text, key } };
    await (await this.conversation(workspaceId, brand)).submit({ type: "input", content: `[Signal] ${text}`, whenBusy: "followUp", requestId: key, entry }, BACKGROUND_CONTEXT);
  }

  async note(workspaceId: string, brand: string, text: string): Promise<void> {
    Trace.line(import.meta.url, "OperatorDesk.note", { workspaceId, brand });
    await (await this.conversation(workspaceId, brand)).submit({ type: "write", entry: { kind: "mra.note", data: { text } } }, BACKGROUND_CONTEXT);
  }

  /** A brand's chat as it stands, then again after every change, until the returned function is called. */
  async watch(workspaceId: string, brand: string, listener: (chat: ChatMessage[]) => void): Promise<() => void> {
    Trace.line(import.meta.url, "OperatorDesk.watch", { workspaceId, brand });
    const view = await (await this.conversation(workspaceId, brand)).viewState(BACKGROUND_CONTEXT);
    listener(ChatView.of(view.value));
    const unsubscribe = view.subscribe((value) => listener(ChatView.of(value)));
    return () => {
      unsubscribe();
      view.dispose();
    };
  }

  /** The workspace's brand chats, each with its name and when it began. */
  async chats(workspaceId: string): Promise<BrandChat[]> {
    Trace.line(import.meta.url, "OperatorDesk.chats", { workspaceId });
    const index = await this.harness.session.snapshot(BrandChatIndex, BACKGROUND_CONTEXT);
    const prefix = `${workspaceId}|`;
    return Object.entries(index?.chats ?? {})
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, chat]) => ({ key: key.slice(prefix.length), label: chat.label, created_at: chat.created_at }));
  }

  private async taskEnded(runId: string, status: string): Promise<void> {
    Trace.line(import.meta.url, "OperatorDesk.taskEnded", { runId, status });
    const run = await this.store.getRun(runId);
    if (!run) return;
    const { counts, error } = Runs.summary(run);
    const objective = String(run.contract?.objective ?? runId);
    const text = `Task ${runId} ended ${status}: ${objective} — ${counts.sources} sources, ${counts.gaps} gaps${error ? `; ${error}` : ""}.`;
    await this.signal(run.workspace_id, Brands.key(run.brief), text, `task:${runId}:ended`);
  }

  private async conversation(workspaceId: string, brand: string, label = ""): Promise<Conversation> {
    Trace.line(import.meta.url, "OperatorDesk.conversation", { workspaceId, brand });
    const session = this.harness.session;
    const root = await session.root(BACKGROUND_CONTEXT);
    const model = { provider: "openrouter", modelId: this.model };
    const extension = this.extension;
    const id: ConversationId = await root.commit(async (tx) => {
      const workspaces = await tx.doc(OperatorIndex);
      const brands = await tx.doc(BrandChatIndex);
      const known = brand ? brands.chats[`${workspaceId}|${brand}`]?.id : workspaces.workspaces[workspaceId];
      if (known !== undefined) return known;
      const created = await tx.createConversation({ ownership: { kind: "ownerless" } });
      await configure(tx, created.id, { model, extensions: [extension] });
      (await tx.doc(WorkspaceDoc, created.id)).workspace_id = workspaceId;
      const name = label || (brand ? Brands.label(brand) : "");
      Object.assign(await tx.doc(BrandDoc, created.id), { key: brand, label: name });
      if (brand) brands.chats[`${workspaceId}|${brand}`] = { id: created.id, label: name, created_at: Clock.nowIso() };
      else workspaces.workspaces[workspaceId] = created.id;
      return created.id;
    }, BACKGROUND_CONTEXT);
    return (await session.conversation(id, BACKGROUND_CONTEXT))!;
  }
}
