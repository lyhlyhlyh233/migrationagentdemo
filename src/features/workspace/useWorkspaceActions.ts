import { useWorkspace, useWorkspaceSession } from "@/app/context";

import { projectUi, type ConversationView } from "@/stores/workspaceState";
import type { StageId } from "@/domain/models";
import {
  currentConversation,
  findStageConversation,
} from "@/domain/conversations";
import type { FilePurpose, ProjectCommand } from "@/services/contracts";
import { errorMessage, ServiceError } from "@/services/errors";
import { saveDownload } from "@/shared/files";
import { readPreference } from "@/shared/preferences";
const emptyProjectUi = projectUi();
export function useWorkspaceActions(projectId: string) {
  const { service, store } = useWorkspaceSession();
  const s = useWorkspace((state) => state.data.snapshots[projectId]);
  const p =
    useWorkspace((state) => state.ui.projects[projectId]) ?? emptyProjectUi;
  const dispatchUi = useWorkspace((state) => state.dispatchUi);
  const dispatchConversation = useWorkspace(
    (state) => state.dispatchConversation,
  );
  const chat = currentConversation(
    s?.conversations ?? [],
    p.conversationId,
    p.activeStage,
  );
  const id = chat?.id ?? null;
  const context = {
    projectId,
    conversationId: id ?? "",
    stageId: chat?.stageId,
    language: readPreference("language"),
  };
  const notify = (notice: string) => {
    if (id)
      dispatchConversation({
        projectId,
        conversationId: id,
        patch: { notice },
      });
    dispatchUi({
      type: "project",
      id: projectId,
      patch: { actionError: id ? "" : notice },
    });
  };
  async function invoke(work: () => Promise<unknown>) {
    notify("");
    try {
      await work();
      return true;
    } catch (error) {
      if (!(error instanceof ServiceError && error.code === "STOPPED"))
        notify(errorMessage(error));
      return false;
    }
  }
  const view = (patch: Partial<ConversationView>) => {
    if (id) dispatchConversation({ projectId, conversationId: id, patch });
  };
  return {
    invoke,
    notify,
    view,
    stop: () => {
      const pending = id ? s.pending[id] : undefined;
      return pending
        ? invoke(() => service.stopReply(context, pending.runId))
        : Promise.resolve(false);
    },
    execute: (cmd: ProjectCommand) =>
      invoke(() =>
        service.execute({ ...context, operationId: crypto.randomUUID() }, cmd),
      ),
    upload: (purpose: FilePurpose, file: File) =>
      invoke(() =>
        service.upload(
          { ...context, operationId: crypto.randomUUID() },
          purpose,
          file,
        ),
      ),
    download: (artifactId: string) =>
      invoke(async () =>
        saveDownload(await service.download(projectId, artifactId)),
      ),
    selectConversation: (conversationId: string, stageId?: StageId) =>
      dispatchUi({
        type: "conversation",
        id: projectId,
        conversationId,
        stageId,
      }),
    newConversation: (stageId?: StageId) =>
      invoke(async () => {
        const c = await service.createConversation(
          projectId,
          stageId,
          context.language,
        );
        dispatchUi({
          type: "conversation",
          id: projectId,
          conversationId: c.id,
          stageId,
          expected: p.conversationId,
        });
      }),
    rename: (conversationId: string, title: string) =>
      invoke(() =>
        service.renameConversation(projectId, conversationId, title),
      ),
    confirmStage: (
      target: StageId,
      confirmation?: { choice: string; note: string },
    ) =>
      invoke(async () => {
        await service.execute(
          { ...context, operationId: crypto.randomUUID() },
          { type: "stage.confirm", target, confirmation },
        );
        const next = await service.getProject(projectId);
        const c = findStageConversation(next.conversations, target);
        if (c)
          dispatchUi({
            type: "conversation",
            id: projectId,
            conversationId: c.id,
            stageId: target,
            expected: p.conversationId,
            collapsePanel:
              target === "planning" && !next.planning?.batches.length,
          });
      }),
    send: async (
      text: string,
      agentId: string,
      modelId: string,
      withAttachment = false,
    ) => {
      const attachment =
        id && withAttachment
          ? store.getState().conversationState[projectId]?.[id]?.attachment
          : undefined;
      if (!id || (!text.trim() && !attachment) || s.pending[id]) return;
      const requestId =
        (withAttachment
          ? store.getState().conversationState[projectId]?.[id]?.requestId
          : undefined) ?? crypto.randomUUID();
      if (withAttachment) view({ draft: "", requestId });
      try {
        await service.sendMessage(context, {
          text,
          agentId,
          modelId,
          requestId,
          attachment,
          context: p.contextLabel || undefined,
          ...(chat?.stageId === "migration"
            ? {
                executionContext: {
                  ...(p.executionView.selected.length
                    ? { taskIds: p.executionView.selected }
                    : {}),
                  ...(p.executionView.batchId
                    ? { batchId: p.executionView.batchId }
                    : {}),
                },
              }
            : {}),
        });
        if (withAttachment)
          view({ requestId: undefined, attachment: undefined });
      } catch (error) {
        if (error instanceof ServiceError && error.code === "STOPPED") {
          if (withAttachment)
            view({ requestId: undefined, attachment: undefined });
        } else {
          notify(errorMessage(error));
          if (withAttachment) view({ draft: text, requestId });
        }
      }
    },
  };
}
