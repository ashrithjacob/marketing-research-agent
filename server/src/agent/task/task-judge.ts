import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import type { Message, Models } from "@earendil-works/pi-ai";
import type { ConversationId } from "@earendil-works/pi-durable";

import { Trace } from "../../trace/index.js";

import type { PiHarness } from "../pi-harness.js";
import { JUDGE_INPUT, JUDGE_SYSTEM } from "../prompt/text/judge.js";

import type { TaskWork } from "./task-work.js";

export interface Verdict {
  stop: boolean;
  question: string;
}

/** The stop_when judge (spec §6.4): after each tool round, a model reads the worker's last step against the owner's condition and says whether to stop and ask. It never decides done. */
export class TaskJudge {
  static readonly STEP_CHARS = 6000;

  constructor(
    private readonly harness: PiHarness,
    private readonly models: Models,
    private readonly modelId: string,
  ) {}

  async verdict(work: TaskWork, conversationId: ConversationId, answers: readonly string[]): Promise<Verdict> {
    Trace.line(import.meta.url, "TaskJudge.verdict", { runId: work.runId, answers: answers.length });
    const condition = work.contract.stop_when ?? "";
    const model = this.models.getModel("openrouter", this.modelId);
    if (!condition || !model) return { stop: false, question: "" };
    const conversation = await this.harness.session.conversation(conversationId, BACKGROUND_CONTEXT);
    const messages = conversation ? (await conversation.context(BACKGROUND_CONTEXT)).messages : [];
    const input = JUDGE_INPUT.replace("{condition}", condition)
      .replace("{objective}", work.contract.objective)
      .replace("{brief}", TaskJudge.brief(work.brief))
      .replace("{answers}", answers.length > 0 ? answers.map((a) => `- ${a}`).join("\n") : "nothing yet")
      .replace("{step}", TaskJudge.lastStep(messages));
    const request: Message[] = [{ role: "user", content: input, timestamp: Date.now() }];
    const key = `judge:${Date.now()}`;
    work.judgeCalls.sent(key, request);
    const answer = await this.models.completeSimple(model, { systemPrompt: JUDGE_SYSTEM, messages: request });
    await work.judgeCalls.answered(key, answer);
    return TaskJudge.parse(answer.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join(""), condition);
  }

  /** The brief as the owner gave it, so a condition about the brief ("the brief does not say which product") is judged against the brief, not guessed. */
  static brief(brief: TaskWork["brief"]): string {
    Trace.line(import.meta.url, "TaskJudge.brief");
    const parts = [brief.product && `product "${brief.product}"`, brief.url && `site or page ${brief.url}`, brief.market && `market ${brief.market}`, brief.notes && `notes: ${brief.notes}`];
    return parts.filter(Boolean).join("; ") || "nothing beyond the task";
  }

  /** The worker's last answer and the tool results that followed it, as text, cut to a size a cheap model reads quickly. */
  static lastStep(messages: readonly Message[]): string {
    Trace.line(import.meta.url, "TaskJudge.lastStep", { messages: messages.length });
    const from = messages.map((m) => m.role).lastIndexOf("assistant");
    const step = from < 0 ? [] : messages.slice(from);
    const text = step
      .map((m) => {
        const parts = typeof m.content === "string" ? [m.content] : m.content.map((p) => ("text" in p ? p.text : p.type === "toolCall" ? `${p.name}(${JSON.stringify(p.arguments)})` : ""));
        return `[${m.role}] ${parts.join(" ")}`;
      })
      .join("\n\n");
    return text.length > TaskJudge.STEP_CHARS ? `${text.slice(0, TaskJudge.STEP_CHARS)}\n[cut]` : text;
  }

  /** The verdict in the model's JSON; anything else is read as "go on", since the judge only ever stops work. */
  static parse(text: string, condition: string): Verdict {
    Trace.line(import.meta.url, "TaskJudge.parse", { chars: text.length });
    try {
      const raw = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { stop?: unknown; question?: unknown };
      if (raw.stop !== true) return { stop: false, question: "" };
      const question = typeof raw.question === "string" && raw.question.trim() ? raw.question.trim() : `This task's stop condition was met (${condition}). How should it go on?`;
      return { stop: true, question };
    } catch {
      return { stop: false, question: "" };
    }
  }
}
