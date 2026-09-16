import { createStore } from "zustand/vanilla";
import type { AccountState } from "@/domain/models";
import {
  dataReducer,
  initialData,
  initialUi,
  uiReducer,
  type DataAction,
  type DataState,
  type UiAction,
  type UiState,
} from "./workspaceState";
import {
  conversationReducer,
  type ConversationAction,
  type ConversationState,
} from "./conversationState";

export interface WorkspaceState {
  data: DataState;
  ui: UiState;
  conversationState: ConversationState;
  account: AccountState;
  dispatchData: (action: DataAction) => void;
  dispatchUi: (action: UiAction) => void;
  dispatchConversation: (action: ConversationAction) => void;
  setAccount: (account: AccountState) => void;
  dispose: () => void;
}
const freshState = () => ({
  data: { ...initialData, snapshots: {} },
  ui: { ...initialUi, projects: {} },
  conversationState: {} as ConversationState,
  account: { configured: false, verified: false } as AccountState,
});

/** One in-memory store per signed-in workspace. Services remain the source of business state. */
export function createWorkspaceStore() {
  let closed = false;
  return createStore<WorkspaceState>()((set) => ({
    ...freshState(),
    dispatchData: (action) => {
      if (!closed) set((state) => ({ data: dataReducer(state.data, action) }));
    },
    dispatchUi: (action) => {
      if (!closed) set((state) => ({ ui: uiReducer(state.ui, action) }));
    },
    dispatchConversation: (action) => {
      if (!closed)
        set((state) => ({
          conversationState: conversationReducer(
            state.conversationState,
            action,
          ),
        }));
    },
    setAccount: (account) => {
      // Only the public state is retained, even if an adapter accidentally returns extra fields.
      if (!closed)
        set({
          account: {
            configured: account.configured,
            verified: account.verified,
            ...(account.method ? { method: account.method } : {}),
          },
        });
    },
    dispose: () => {
      closed = true;
      set(freshState());
    },
  }));
}
export type WorkspaceStore = ReturnType<typeof createWorkspaceStore>;
