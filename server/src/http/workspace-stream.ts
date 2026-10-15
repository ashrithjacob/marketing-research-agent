import type { Hono } from "hono";
import { streamSSE, type SSEStreamingApi } from "hono/streaming";

import type { OperatorDesk, WorkspaceBoard } from "../agent/index.js";
import { Trace } from "../trace/index.js";

import type { ApiEnv } from "./api-env.js";

/** One stream per brand chat of a workspace (spec §8): a snapshot of the brand's chat and the workspace's board, then each change. The chat comes from the operator conversation's watch, sent at most every half second; the board is read from the store every two seconds and sent when it differs. */
export class WorkspaceStream {
  static readonly TICK_MS = 500;
  static readonly BOARD_TICKS = 4;
  static readonly KEEPALIVE_TICKS = 40;

  constructor(
    private readonly operator: OperatorDesk,
    private readonly board: WorkspaceBoard,
  ) {}

  register(api: Hono<ApiEnv>): void {
    Trace.line(import.meta.url, "WorkspaceStream.register");
    api.get("/workspace/stream", (c) => {
      const workspaceId = c.get("principal").workspaceId;
      const brand = c.req.query("brand") ?? "";
      return streamSSE(c, (stream) => this.follow(stream, workspaceId, brand));
    });
  }

  private async follow(stream: SSEStreamingApi, workspaceId: string, brand: string): Promise<void> {
    Trace.line(import.meta.url, "WorkspaceStream.follow", { workspaceId, brand });
    let closed = false;
    stream.onAbort(() => {
      closed = true;
    });
    const chats: string[] = [];
    const stop = await this.operator.watch(workspaceId, brand, (chat) => chats.push(JSON.stringify(chat)));
    let lastChat = "";
    let lastBoard = "";
    try {
      for (let tick = 0; !closed; tick++) {
        const chat = chats.splice(0).pop();
        if (chat !== undefined && chat !== lastChat) await stream.writeSSE({ event: "chat", data: (lastChat = chat) });
        if (tick % WorkspaceStream.BOARD_TICKS === 0) {
          const board = JSON.stringify(await this.board.snapshot(workspaceId));
          if (board !== lastBoard) await stream.writeSSE({ event: "board", data: (lastBoard = board) });
        }
        if (tick % WorkspaceStream.KEEPALIVE_TICKS === WorkspaceStream.KEEPALIVE_TICKS - 1) await stream.writeSSE({ event: "keepalive", data: "" });
        await stream.sleep(WorkspaceStream.TICK_MS);
      }
    } finally {
      stop();
    }
  }
}
