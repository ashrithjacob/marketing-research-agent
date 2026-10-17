import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ToolRegistration } from "@earendil-works/pi-durable";

import type { DocumentLibrary, ResearchRun } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { LibraryTools } from "../tools/library-tools.js";

import { OperatorAct } from "./operator-act.js";

/** Turns a ready memory-folder document into a playbook proposal: a task whose result is a lesson card the owner approves. */
export interface PlaybookMaker {
  distil(workspaceId: string, documentId: string): Promise<ResearchRun>;
}

/** The operator's hand on the owner's memory folder: the same two library tools every research task has, bound to the workspace of the conversation that calls them, and turning a document into a playbook. */
export class LibraryShelfTools {
  constructor(
    private readonly library: DocumentLibrary,
    private readonly playbooks: PlaybookMaker,
  ) {}

  tools(): ToolRegistration[] {
    Trace.line(import.meta.url, "LibraryShelfTools.tools");
    const shelf = (workspace: string) => new LibraryTools(this.library, workspace);
    return [
      defineTool({
        name: "library_index",
        description: "The documents and playbooks the owner put in the memory folder, each with its id and numbered sections.",
        parameters: Type.Object({}),
        execute: (_args, api, context) => OperatorAct.run(api, context, async (workspace) => LibraryShelfTools.text(await shelf(workspace).index().execute(api.callId, {}))),
      }),
      defineTool({
        name: "library_read",
        description: "One numbered section of a memory-folder document, as markdown.",
        parameters: Type.Object({ document_id: Type.String(), section: Type.Number() }),
        execute: (args, api, context) => OperatorAct.run(api, context, async (workspace) => LibraryShelfTools.text(await shelf(workspace).read().execute(api.callId, args))),
      }),
      defineTool({
        name: "make_playbook",
        description: "Turn a memory-folder document into a playbook for writing ads: an agent reads it and proposes one, which comes back to the owner as a card to approve. Model calls only; a few minutes.",
        parameters: Type.Object({ document_id: Type.String() }),
        execute: (args, api, context) =>
          OperatorAct.run(api, context, async (workspace) => `Reading it now (task ${(await this.playbooks.distil(workspace, args.document_id)).id}); the proposed playbook comes back as a card to approve.`),
      }),
    ];
  }

  private static text(result: { content: readonly { type: string; text?: string }[] }): string {
    Trace.line(import.meta.url, "LibraryShelfTools.text");
    return result.content.map((part) => part.text ?? "").join("\n");
  }
}
