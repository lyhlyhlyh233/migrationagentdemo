import { describe, expect, it, vi } from "vitest";
import { createWorkspaceStore } from "@/stores/workspaceStore";
import { connectWorkspace } from "../workspaceSession";
import { MockMigrationService } from "@/services/mock";
import type { MigrationService, ServiceEvent } from "@/services/contracts";

describe("workspace service subscription bridge", () => {
  it("supports setup-cleanup-setup with a fresh store and one subscription", async () => {
    const service = new MockMigrationService();
    const previous = createWorkspaceStore();
    const first = connectWorkspace(previous, service);
    first.dispose();
    const current = createWorkspaceStore();
    const second = connectWorkspace(current, service);
    try {
      await second.retry();
      expect(current.getState().data.loading).toBe(false);
      expect(current.getState().data.snapshots.lobby).toBeDefined();
      expect(service.runtime.listeners.size).toBe(1);
      previous.getState().dispatchConversation({
        projectId: "p",
        conversationId: "c",
        patch: { draft: "late" },
      });
      expect(previous.getState().conversationState).toEqual({});
      expect(current.getState().conversationState).toEqual({});
    } finally {
      second.dispose();
      expect(service.runtime.listeners.size).toBe(0);
      service.dispose();
    }
  });

  it("keeps a newer subscription snapshot when an older bootstrap read completes", async () => {
    const service = new MockMigrationService();
    const lobby = await service.getProject("lobby");
    const reads: ((value: typeof lobby) => void)[] = [];
    service.getProject = () =>
      new Promise((resolve) => {
        reads.push(resolve);
      });
    const store = createWorkspaceStore();
    const session = connectWorkspace(store, service);
    try {
      const latestRead = session.retry();
      service.runtime.listeners.forEach((listener) =>
        listener({
          type: "snapshot",
          projectId: "lobby",
          snapshot: { ...lobby, revision: 10 },
        }),
      );
      reads[1]({ ...lobby, revision: 5 });
      await latestRead;
      reads[0]({ ...lobby, revision: 1 });
      await Promise.resolve();
      await Promise.resolve();
      expect(store.getState().data.snapshots.lobby.revision).toBe(10);
      expect(store.getState().data.loading).toBe(false);
    } finally {
      session.dispose();
      service.dispose();
    }
  });

  it("loads service state and routes notices to the originating conversation without navigation", async () => {
    const service = new MockMigrationService();
    await service.configureAccount({ method: "api-key", apiKey: "sample-key" });
    const store = createWorkspaceStore();
    const session = connectWorkspace(store, service);
    await session.retry();
    expect(store.getState().data.loading).toBe(false);
    expect(store.getState().data.catalog).not.toBeNull();
    expect(store.getState().account).toEqual({
      configured: true,
      verified: false,
      method: "api-key",
    });
    store
      .getState()
      .dispatchUi({ type: "conversation", id: "p", conversationId: "visible" });
    service.runtime.listeners.forEach((listener) =>
      listener({
        type: "notice",
        projectId: "p",
        conversationId: "origin",
        text: "初始化失败，请重试",
      }),
    );
    expect(store.getState().conversationState.p.origin.notice).toContain(
      "初始化失败",
    );
    expect(store.getState().conversationState.p.visible).toBeUndefined();
    expect(store.getState().ui.projects.p.conversationId).toBe("visible");
    session.dispose();
    expect(service.runtime.listeners.size).toBe(0);
    service.dispose();
  });
  it("aborts bootstrap and ignores late promise/event results when disposed", async () => {
    const mock = new MockMigrationService();
    const lobby = await mock.getProject("lobby");
    let finish!: (value: typeof lobby) => void;
    let listener!: (event: ServiceEvent) => void;
    let signal: AbortSignal | undefined;
    const unsubscribe = vi.fn();
    const service: MigrationService = Object.assign(mock, {
      getProject: (_id: string, options?: { signal?: AbortSignal }) => {
        signal = options?.signal;
        return new Promise<typeof lobby>((resolve) => {
          finish = resolve;
        });
      },
      subscribe: (fn: typeof listener) => {
        listener = fn;
        return unsubscribe;
      },
    });
    const store = createWorkspaceStore();
    const session = connectWorkspace(store, service);
    session.dispose();
    finish(lobby);
    listener({ type: "snapshot", projectId: "lobby", snapshot: lobby });
    listener({
      type: "error",
      projectId: "p",
      conversationId: "c",
      message: "late failure",
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(signal?.aborted).toBe(true);
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(store.getState().data.snapshots).toEqual({});
    expect(store.getState().conversationState).toEqual({});
    mock.dispose();
  });
});
