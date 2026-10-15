import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ToolRegistration } from "@earendil-works/pi-durable";

import type { DocumentLibrary } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { LibraryTools } from "../tools/library-tools.js";

import { OperatorAct } from "./operator-act.js";

/** The operator's reading of the owner's memory folder: the same two library tools every research task has, bound to the workspace of the conversation that calls them. */
export class LibraryShelfTools {
  constructor(private readonly library: DocumentLibrary) {}

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
    ];
  }

  private static text(result: { content: readonly { type: string; text?: string }[] }): string {
    Trace.line(import.meta.url, "LibraryShelfTools.text");
    return result.content.map((part) => part.text ?? "").join("\n");
  }
}
