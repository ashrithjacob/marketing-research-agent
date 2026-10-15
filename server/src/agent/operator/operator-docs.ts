import { defineDoc, type ConversationId } from "@earendil-works/pi-durable";

/** For the whole harness: each workspace's operator conversation from before chats were per brand, which still takes what belongs to no brand. */
export const OperatorIndex = defineDoc<{ workspaces: Record<string, ConversationId> }>({
  kind: "mra.operators",
  version: 1,
  scope: "session",
  initial: () => ({ workspaces: {} }),
});

/** For the whole harness: each brand's operator conversation, keyed by workspace and brand key, with the brand's name and when its chat began. */
export const BrandChatIndex = defineDoc<{ chats: Record<string, { id: ConversationId; label: string; created_at: string }> }>({
  kind: "mra.brand-chats",
  version: 1,
  scope: "session",
  initial: () => ({ chats: {} }),
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

/** On an operator conversation: the brand its chat is about; "" for the workspace's own. */
export const BrandDoc = defineDoc<{ key: string; label: string }>({
  kind: "mra.brand",
  version: 1,
  scope: "conversation",
  history: "latest",
  fork: "current",
  initial: () => ({ key: "", label: "" }),
});
