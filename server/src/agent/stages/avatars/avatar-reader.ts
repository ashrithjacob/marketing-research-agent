import { MemoryUpdateSchema, type AvatarMemory, type MemoryUpdate, type StoredReview } from "../../../domain/index.js";
import { AvatarMemoryCheck } from "../../../extract/index.js";
import { Trace } from "../../../trace/index.js";
import type { AgentResult } from "../../kernel/agent-runner.js";
import type { RunContext } from "../../pipeline/run-context.js";
import { AVATAR_READER_SYSTEM } from "../../prompt/text/avatars.js";

import { MemoryView } from "./memory-view.js";

/** Reads one batch of reviews against the avatar memory and hands back how the memory changes; code checks every key and every review id. */
export class AvatarReader {
  static readonly MAX_TURNS = 4;

  async read(context: RunContext, memory: AvatarMemory, batch: readonly StoredReview[], contextLine: string): Promise<AgentResult<MemoryUpdate>> {
    Trace.line(import.meta.url, "AvatarReader.read", { batch: batch.length, read: memory.batches_read });
    const ids = batch.map((review) => review.id);
    return context.agent({
      agentId: `avatar_reader:${memory.batches_read + 1}`,
      system: AVATAR_READER_SYSTEM,
      instructions: [contextLine, MemoryView.memory(memory), `Batch ${memory.batches_read + 1}, ${batch.length} reviews:`, MemoryView.reviews(batch)].join("\n\n"),
      tools: [],
      maxTurns: AvatarReader.MAX_TURNS,
      reasoning: "low",
      submission: { schema: MemoryUpdateSchema, describe: "Hand back how the avatar memory changes after this batch.", check: (update) => AvatarMemoryCheck.problems(memory, update, ids) },
    });
  }
}
