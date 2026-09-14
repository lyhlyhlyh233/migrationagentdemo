import { conversationReducer } from "@/features/conversations/state";
import { describe, expect, it } from "vitest";
import { initialUi, uiReducer } from "../state";
describe("workspace UI isolation", () => {
  it("keeps risk navigation targets scoped to their project", () => {
    const a = uiReducer(initialUi, {
      type: "project",
      id: "a",
      patch: { panel: "risk", riskLocation: { mode: "vm", vmKey: "id:vm-1" } },
    });
    const b = uiReducer(a, {
      type: "project",
      id: "b",
      patch: { panel: "risk" },
    });
    expect(b.projects.a.riskLocation).toEqual({ mode: "vm", vmKey: "id:vm-1" });
    expect(b.projects.b.riskLocation).toEqual({ mode: "category" });
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
