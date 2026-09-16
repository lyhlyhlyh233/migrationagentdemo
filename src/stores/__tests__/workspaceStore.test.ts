import { describe, expect, it } from "vitest";
import { createWorkspaceStore } from "../workspaceStore";
import type { ProjectSnapshot, AccountState } from "@/domain/models";
import { MockMigrationService } from "@/services/mock";

describe("session-owned workspace stores", () => {
  it("isolates projects, conversations, attachments and store instances", () => {
    const a = createWorkspaceStore(),
      b = createWorkspaceStore();
    a.getState().dispatchConversation({
      projectId: "p1",
      conversationId: "main",
      patch: { draft: "first", attachment: new File(["demo"], "plan.xls") },
    });
    a.getState().dispatchConversation({
      projectId: "p2",
      conversationId: "main",
      patch: { draft: "second" },
    });
    a.getState().dispatchConversation({
      projectId: "p1",
      conversationId: "child",
      patch: { draft: "child" },
    });
    a.getState().dispatchUi({
      type: "execution-view",
      id: "p1",
      patch: { batchId: "B-004", selected: ["vm1"] },
    });
    expect(a.getState().conversationState.p1.main.attachment?.name).toBe(
      "plan.xls",
    );
    expect(a.getState().conversationState.p2.main).toEqual({ draft: "second" });
    expect(a.getState().conversationState.p1.child).toEqual({ draft: "child" });
    expect(b.getState().conversationState).toEqual({});
    expect(b.getState().ui.projects).toEqual({});
  });
  it("uses current project state for delayed patches and rejects old snapshots", async () => {
    const store = createWorkspaceStore(),
      service = new MockMigrationService();
    const lobby = await service.getProject("lobby");
    store
      .getState()
      .dispatchData({ type: "snapshot", snapshot: { ...lobby, revision: 10 } });
    store
      .getState()
      .dispatchData({ type: "snapshot", snapshot: { ...lobby, revision: 9 } });
    expect(store.getState().data.snapshots.lobby.revision).toBe(10);
    store.getState().dispatchUi({
      type: "execution-view",
      id: "p",
      patch: { batchId: "B-004", dashboardPage: 3 },
    });
    const delayed = store.getState().dispatchUi;
    store.getState().dispatchUi({
      type: "execution-view",
      id: "p",
      patch: { batchId: "B-007", dashboardPage: 2 },
    });
    delayed({
      type: "execution-view",
      id: "p",
      patch: { connectionDraft: undefined },
    });
    expect(store.getState().ui.projects.p.executionView).toMatchObject({
      batchId: "B-007",
      dashboardPage: 2,
    });
    service.dispose();
  });
  it("keeps active conversation on late handoff, and collapses the panel only on accepted navigation", () => {
    const store = createWorkspaceStore();
    const dispatch = store.getState().dispatchUi;
    dispatch({
      type: "project",
      id: "p",
      patch: { sidePanel: { tabs: ["risk"], active: "risk", open: true } },
    });
    dispatch({ type: "conversation", id: "p", conversationId: "other" });
    dispatch({
      type: "conversation",
      id: "p",
      conversationId: "planning",
      expected: "origin",
      collapsePanel: true,
    });
    expect(store.getState().ui.projects.p.sidePanel.open).toBe(true);
    expect(store.getState().ui.projects.p.conversationId).toBe("other");
    dispatch({
      type: "conversation",
      id: "p",
      conversationId: "planning",
      expected: "other",
      collapsePanel: true,
    });
    expect(store.getState().ui.projects.p.sidePanel).toEqual({
      tabs: ["risk"],
      active: "risk",
      open: false,
    });
  });
  it("guards delayed conversation creation even when the original selection was implicit", () => {
    const store = createWorkspaceStore();
    const dispatch = store.getState().dispatchUi;
    dispatch({
      type: "conversation",
      id: "p",
      conversationId: "selected-later",
    });
    dispatch({
      type: "conversation",
      id: "p",
      conversationId: "created",
      expected: null,
    });
    expect(store.getState().ui.projects.p.conversationId).toBe(
      "selected-later",
    );
    dispatch({
      type: "conversation",
      id: "other",
      conversationId: "created",
      expected: null,
    });
    expect(store.getState().ui.projects.other.conversationId).toBe("created");
    dispatch({ type: "project", id: "p", patch: { conversationId: null } });
    dispatch({
      type: "conversation",
      id: "p",
      conversationId: "stale-handoff",
      expected: "selected-later",
    });
    expect(store.getState().ui.projects.p.conversationId).toBeNull();
  });
  it("keeps only sanitized account status and discards late writes after signout", () => {
    const store = createWorkspaceStore();
    store.getState().setAccount({
      configured: true,
      verified: true,
      method: "api-key",
      apiKey: "must-not-retain",
    } as AccountState);
    expect(store.getState().account).toEqual({
      configured: true,
      verified: true,
      method: "api-key",
    });
    const old = store.getState();
    old.dispatchConversation({
      projectId: "p",
      conversationId: "c",
      patch: { draft: "private", attachment: new File(["x"], "x.xls") },
    });
    old.dispose();
    old.dispatchConversation({
      projectId: "p",
      conversationId: "c",
      patch: { draft: "late" },
    });
    old.dispatchData({
      type: "snapshot",
      snapshot: { id: "p", revision: 1 } as ProjectSnapshot,
    });
    old.setAccount({ configured: true, verified: true });
    expect(store.getState().conversationState).toEqual({});
    expect(store.getState().data.snapshots).toEqual({});
    expect(store.getState().account.configured).toBe(false);
  });
});
