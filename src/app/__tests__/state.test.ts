import { conversationReducer } from "@/stores/conversationState";
import { describe, expect, it } from "vitest";
import { initialUi, uiReducer, type UiAction } from "@/stores/workspaceState";
describe("workspace UI isolation", () => {
  it("remembers the assessment risk prompt across navigation without affecting another project", () => {
    const opened = uiReducer(initialUi, {
      type: "project",
      id: "a",
      patch: { assessmentRiskOpened: true },
    });
    const creating = uiReducer(opened, {
      type: "global",
      patch: { creating: true },
    });
    const returned = uiReducer(creating, {
      type: "global",
      patch: { creating: false },
    });
    const other = uiReducer(returned, {
      type: "conversation",
      id: "b",
      conversationId: "research-b",
      stageId: "research",
    });
    expect(other.projects.a.assessmentRiskOpened).toBe(true);
    expect(other.projects.b.assessmentRiskOpened).toBe(false);
  });
  it("keeps risk navigation targets scoped to their project", () => {
    const a = uiReducer(initialUi, {
      type: "project",
      id: "a",
      patch: {
        riskLocation: { category: "compatibility" },
      },
    });
    const b = uiReducer(a, {
      type: "project",
      id: "b",
      patch: { assessmentRiskOpened: true },
    });
    expect(b.projects.a.riskLocation).toEqual({
      category: "compatibility",
    });
    expect(b.projects.b.riskLocation).toEqual({});
  });
  it("stale handoff completion cannot replace a subsequently selected conversation", () => {
    const next = uiReducer(initialUi, {
      type: "conversation",
      id: "p",
      conversationId: "newer",
      stageId: "research",
    });
    expect(
      uiReducer(next, {
        type: "conversation",
        id: "p",
        conversationId: "planning-main",
        stageId: "planning",
        expected: "older",
      }),
    ).toBe(next);
    expect(
      uiReducer(next, {
        type: "conversation",
        id: "p",
        conversationId: "created-from-implicit",
        expected: null,
      }),
    ).toBe(next);
    expect(
      uiReducer(initialUi, {
        type: "conversation",
        id: "p",
        conversationId: "created-from-implicit",
        expected: null,
      }).projects.p.conversationId,
    ).toBe("created-from-implicit");
  });
  it("merges delayed execution patches into the latest project view without replacing navigation", () => {
    let state = uiReducer(initialUi, {
      type: "execution-view",
      id: "a",
      patch: {
        batchId: "B-004",
        connectionDraft: {
          ip: "192.0.2.10",
          port: 443,
          username: "example",
        },
      },
      contextLabel: "B-004",
    });
    const connectionComplete: UiAction = {
      type: "execution-view",
      id: "a",
      patch: { connectionDraft: undefined },
    };
    state = uiReducer(state, {
      type: "execution-view",
      id: "a",
      patch: { batchId: "B-003", dashboardPage: 2, selected: ["task-21"] },
      contextLabel: "B-003 · task-21",
    });
    state = uiReducer(state, {
      type: "execution-view",
      id: "b",
      patch: { batchId: "B-007", dashboardPage: 3, selected: ["task-b"] },
      contextLabel: "B-007",
    });
    const other = state.projects.b;
    state = uiReducer(state, connectionComplete);
    expect(state.projects.a.executionView).toMatchObject({
      batchId: "B-003",
      dashboardPage: 2,
      selected: ["task-21"],
      connectionDraft: undefined,
    });
    expect(state.projects.a.contextLabel).toBe("B-003 · task-21");
    state = uiReducer(state, {
      type: "execution-view",
      id: "a",
      patch: { selected: [] },
    });
    expect(state.projects.a.executionView).toMatchObject({
      batchId: "B-003",
      dashboardPage: 2,
      selected: [],
    });
    expect(state.projects.b).toBe(other);
    expect(state.projects.a.contextLabel).toBe("B-003 · task-21");
  });
  it("keeps drafts, model selections and expanded work scoped by project and conversation", () => {
    let s = conversationReducer(
      {},
      {
        projectId: "a",
        conversationId: "main",
        patch: { draft: "A", modelId: "m1", workOpen: true },
      },
    );
    s = conversationReducer(s, {
      projectId: "b",
      conversationId: "main",
      patch: { draft: "B" },
    });
    s = conversationReducer(s, {
      projectId: "a",
      conversationId: "child",
      patch: { draft: "child" },
    });
    expect(s.a.main).toEqual({ draft: "A", modelId: "m1", workOpen: true });
    expect(s.b.main.draft).toBe("B");
    expect(s.a.child.workOpen).toBeUndefined();
  });
});
