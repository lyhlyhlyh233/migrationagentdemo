import { describe, expect, it } from "vitest";
import { currentConversation, findStageConversation } from "../conversations";
import type { Conversation } from "../models";

const conversations: Conversation[] = [
  { id: "server-chat-82", stageId: "research", kind: "main", title: "评估" },
  {
    id: "server-chat-17",
    stageId: "research",
    kind: "child",
    title: "磁盘核对",
  },
  { id: "server-chat-91", stageId: "planning", kind: "main", title: "规划" },
  { id: "server-chat-23", kind: "temporary", title: "临时讨论" },
];

describe("service-owned conversation identities", () => {
  it("opens the actual main conversation and restores a stage's recent child", () => {
    expect(currentConversation(conversations, null, "research")?.id).toBe(
      "server-chat-82",
    );
    expect(
      findStageConversation(conversations, "research", "server-chat-17")?.id,
    ).toBe("server-chat-17");
    expect(findStageConversation(conversations, "planning")?.id).toBe(
      "server-chat-91",
    );
  });
  it("falls back to the stage main if a remembered chat is missing or from another stage", () => {
    for (const preferred of ["removed", "server-chat-91", "server-chat-23"])
      expect(
        findStageConversation(conversations, "research", preferred)?.id,
      ).toBe("server-chat-82");
    expect(currentConversation(conversations, "removed", "planning")?.id).toBe(
      "server-chat-91",
    );
  });
  it("keeps temporary selection and never synthesizes missing stage or project conversations", () => {
    expect(
      currentConversation(conversations, "server-chat-23", "research")?.kind,
    ).toBe("temporary");
    expect(findStageConversation(conversations, "migration")).toBeUndefined();
    expect(
      currentConversation([], "server-chat-82", "research"),
    ).toBeUndefined();
  });
});
