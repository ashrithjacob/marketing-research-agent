import { Type } from "@earendil-works/pi-ai";
import { defineExtension, defineTool, section, type Extension, type ToolExecutionApi } from "@earendil-works/pi-durable";
import type { Context } from "@earendil-works/chord";

import type { LessonChange, Playbook, PlaybookSection, ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { RunError } from "../errors.js";
import { WorkspaceDoc } from "../operator/operator-docs.js";
import { REVIEWER_SYSTEM } from "../prompt/text/reviewer.js";

import type { LessonDesk } from "./lesson-desk.js";
import { PlaybookShelf } from "./playbook-shelf.js";

const sectionShape = Type.Object({ key: Type.String(), title: Type.String(), describe: Type.String() });

/** The reviewer's only powers: to propose a lesson on brand memory, or a new version of a playbook it saw in use (spec §5.3). Both are staged; the owner decides. */
export class ReviewerTools {
  constructor(
    private readonly store: ResearchStore,
    private readonly lessons: LessonDesk,
  ) {}

  extension(): Extension {
    Trace.line(import.meta.url, "ReviewerTools.extension");
    return defineExtension({ name: "mra.reviewer", sections: [section("reviewer", () => REVIEWER_SYSTEM, { tag: false })], tools: [this.memory(), this.playbook()] });
  }

  private memory() {
    Trace.line(import.meta.url, "ReviewerTools.memory");
    return defineTool({
      name: "propose_lesson",
      description: "Propose one lesson for the owner to approve: add to brand memory, change an entry (entry_id), or remove one (entry_id). Name the feedback ids it comes from.",
      parameters: Type.Object({
        change: Type.Union([Type.Literal("add"), Type.Literal("change"), Type.Literal("remove")]),
        entry_id: Type.Optional(Type.String()),
        text: Type.Optional(Type.String()),
        why: Type.String(),
        feedback_ids: Type.Array(Type.String()),
      }),
      execute: async (args, api, context) => {
        Trace.line(import.meta.url, "ReviewerTools.memory.execute", { change: args.change });
        return this.stage(api, context, () => ReviewerTools.memoryChange(args), args.why, args.feedback_ids);
      },
    });
  }

  private playbook() {
    Trace.line(import.meta.url, "ReviewerTools.playbook");
    return defineTool({
      name: "propose_playbook_change",
      description:
        "Propose a new version of a playbook a draft was written with, when the owner's edits or rejections show how it should change. Give the whole new list of sections or of criteria you change; leave out the one you keep. Name the feedback ids it comes from.",
      parameters: Type.Object({
        playbook: Type.String({ description: "The playbook's key." }),
        sections: Type.Optional(Type.Array(sectionShape)),
        criteria: Type.Optional(Type.Array(Type.String())),
        why: Type.String(),
        feedback_ids: Type.Array(Type.String()),
      }),
      execute: async (args, api, context) => {
        Trace.line(import.meta.url, "ReviewerTools.playbook.execute", { playbook: args.playbook });
        const current = await new PlaybookShelf(this.store).current(await ReviewerTools.workspace(api, context), args.playbook);
        return this.stage(api, context, () => ReviewerTools.playbookChange(current, args), args.why, args.feedback_ids);
      },
    });
  }

  private async stage(api: ToolExecutionApi, context: Context, change: () => LessonChange, why: string, feedbackIds: string[]) {
    Trace.line(import.meta.url, "ReviewerTools.stage", { feedback: feedbackIds.length });
    try {
      const lesson = await this.lessons.stage(await ReviewerTools.workspace(api, context), change(), why, feedbackIds);
      return { output: [{ type: "text" as const, text: `Staged lesson ${lesson.id}; the owner decides on its card.` }] };
    } catch (error) {
      if (!(error instanceof RunError)) throw error;
      return { output: [{ type: "text" as const, text: `Refused: ${error.message}` }], isError: true };
    }
  }

  private static async workspace(api: ToolExecutionApi, context: Context): Promise<string> {
    Trace.line(import.meta.url, "ReviewerTools.workspace");
    return (await api.snapshot(WorkspaceDoc, api.conversationId, context))?.workspace_id ?? "";
  }

  private static playbookChange(current: Playbook | null, args: { playbook: string; sections?: PlaybookSection[]; criteria?: string[] }): LessonChange {
    Trace.line(import.meta.url, "ReviewerTools.playbookChange", { playbook: args.playbook });
    if (!current) throw new RunError(`no playbook ${args.playbook}`);
    return { kind: "playbook_change", from_version: current.version, playbook: { ...current, sections: args.sections ?? current.sections, criteria: args.criteria ?? current.criteria } };
  }

  private static memoryChange(args: { change: string; entry_id?: string; text?: string }): LessonChange {
    Trace.line(import.meta.url, "ReviewerTools.memoryChange", { change: args.change });
    const text = (args.text ?? "").trim();
    if (args.change === "remove") return { kind: "memory_remove", entry_id: args.entry_id ?? "" };
    if (!text) throw new RunError("a lesson that adds or changes memory needs its text");
    return args.change === "change" ? { kind: "memory_change", entry_id: args.entry_id ?? "", text } : { kind: "memory_add", text };
  }
}
