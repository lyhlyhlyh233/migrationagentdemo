/** Conversation-local interaction state. Business replies and task state belong to the service. */
export interface ConversationView {
  draft: string;
  agentId?: string;
  modelId?: string;
  workOpen?: boolean;
  requestId?: string;
}
export type ConversationState = Record<
  string,
  Record<string, ConversationView>
>;
export interface ConversationAction {
  projectId: string;
  conversationId: string;
  patch: Partial<ConversationView>;
}
export function conversationReducer(
  state: ConversationState,
  action: ConversationAction,
): ConversationState {
  const project = state[action.projectId] ?? {};
  return {
    ...state,
    [action.projectId]: {
      ...project,
      [action.conversationId]: {
        ...(project[action.conversationId] ?? { draft: "" }),
        ...action.patch,
      },
    },
  };
}
