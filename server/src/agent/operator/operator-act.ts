import type { Context } from "@earendil-works/chord";
import type { ToolExecutionApi, ToolExecutionResult } from "@earendil-works/pi-durable";

import { Trace } from "../../trace/index.js";

import { RunError } from "../errors.js";

import { BrandDoc, WorkspaceDoc } from "./operator-docs.js";

/** Runs one operator tool inside the workspace its conversation belongs to, and hands a refusal back to the model as an error result rather than a crash. */
export class OperatorAct {
  static async run(api: ToolExecutionApi, context: Context, work: (workspace: string) => Promise<string>): Promise<ToolExecutionResult> {
    Trace.line(import.meta.url, "OperatorAct.run", { conversation: api.conversationId });
    const workspace = (await api.snapshot(WorkspaceDoc, api.conversationId, context))?.workspace_id ?? "";
    try {
      return { output: [{ type: "text", text: await work(workspace) }] };
    } catch (error) {
      if (!(error instanceof RunError)) throw error;
      return { output: [{ type: "text", text: error.message }], isError: true };
    }
  }

  /** The brand the calling conversation's chat is about; "" for the workspace's own. */
  static async brand(api: ToolExecutionApi, context: Context): Promise<string> {
    Trace.line(import.meta.url, "OperatorAct.brand", { conversation: api.conversationId });
    return (await api.snapshot(BrandDoc, api.conversationId, context))?.key ?? "";
  }
}
