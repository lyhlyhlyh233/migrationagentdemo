import { useEffect } from "react";
import type { ProjectSnapshot } from "@/domain/models";
import type { ConversationConfirmation, ConversationView } from "./state";

/** Only explicit previews in this conversation may open its composer. */
export function useConversationConfirmation(
  snapshot: ProjectSnapshot,
  conversationId: string | undefined,
  view: ConversationView,
  onView: (patch: Partial<ConversationView>) => void,
) {
  const latest = snapshot.messages.findLast(
    (message) =>
      message.conversationId === conversationId &&
      message.results?.some((result) =>
        ["approval", "execution-preview", "planning-preview"].includes(
          result.kind,
        ),
      ),
  );
  const result = latest?.results?.findLast((item) =>
    ["approval", "execution-preview", "planning-preview"].includes(item.kind),
  );
  const token = latest ? String(latest.id) : undefined;
  let candidate: ConversationConfirmation | undefined;
  if (
    result?.kind === "approval" &&
    snapshot.approvals.some(
      (a) => a.id === result.approvalId && a.status === "pending",
    )
  )
    candidate = { kind: "stage", id: result.approvalId };
  if (
    result?.kind === "execution-preview" &&
    snapshot.execution?.preview?.id === result.previewId
  )
    candidate = { kind: "execution", id: result.previewId };
  if (
    result?.kind === "planning-preview" &&
    snapshot.planning?.batches.length &&
    snapshot.planning.preview?.id === result.previewId
  )
    candidate = { kind: "planning", id: result.previewId };
  useEffect(() => {
    if (
      !token ||
      token === view.handledConfirmation ||
      snapshot.pending[conversationId ?? ""]
    )
      return;
    // Remember incoming results even while another form is open; never replace its draft.
    onView({
      handledConfirmation: token,
      ...(!view.confirmation && candidate ? { confirmation: candidate } : {}),
    });
  }, [
    token,
    view.handledConfirmation,
    view.confirmation,
    candidate,
    conversationId,
    snapshot.pending,
    onView,
  ]);
  const active = view.confirmation;
  const executionPreview = snapshot.execution?.preview;
  useEffect(() => {
    if (
      active?.kind === "tasks" &&
      executionPreview &&
      executionPreview.origin.conversationId === conversationId
    )
      onView({ confirmation: { kind: "execution", id: executionPreview.id } });
  }, [active, executionPreview, conversationId, onView]);
  const expired =
    active &&
    ((active.kind === "execution" &&
      snapshot.execution?.preview?.id !== active.id) ||
      (active.kind === "planning" &&
        snapshot.planning?.preview?.id !== active.id) ||
      (active.kind === "stage" &&
        !snapshot.approvals.some(
          (a) => a.id === active.id && a.status === "pending",
        )));
  useEffect(() => {
    if (expired) onView({ confirmation: undefined });
  }, [expired, onView]);
  return expired ? undefined : active;
}
