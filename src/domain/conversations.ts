import type { Conversation, StageId } from "./models";

// IDs come from the service. A stage name is never used to reconstruct an ID.
export function findStageConversation(
  conversations: readonly Conversation[],
  stageId: StageId,
  preferredId?: string,
) {
  return (
    conversations.find((c) => c.id === preferredId && c.stageId === stageId) ??
    conversations.find((c) => c.stageId === stageId && c.kind === "main")
  );
}

export function currentConversation(
  conversations: readonly Conversation[],
  selectedId: string | null,
  stageId: StageId,
) {
  return (
    conversations.find((c) => c.id === selectedId) ??
    findStageConversation(conversations, stageId)
  );
}
