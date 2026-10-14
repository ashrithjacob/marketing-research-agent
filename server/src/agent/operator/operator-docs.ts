import { defineDoc, type ConversationId } from "@earendil-works/pi-durable";

/** For the whole harness: each workspace's operator conversation. */
export const OperatorIndex = defineDoc<{ workspaces: Record<string, ConversationId> }>({
  kind: "mra.operators",
  version: 1,
  scope: "session",
  initial: () => ({ workspaces: {} }),
});

/** On an operator conversation: the workspace it works for. */
export const WorkspaceDoc = defineDoc<{ workspace_id: string }>({
  kind: "mra.workspace",
  version: 1,
  scope: "conversation",
  history: "latest",
  fork: "current",
  initial: () => ({ workspace_id: "" }),
});
