import { ConversationConfirmation } from "@/features/conversations/ConversationConfirmation";
import { useConversationConfirmation } from "@/features/conversations/useConversationConfirmation";
import type { ConversationConfirmation as ConfirmationValue } from "@/features/conversations/state";
import { ConnectionForm } from "@/features/migration/ConnectionForm";
import { executionBlock } from "@/domain/execution";
import { ExecutionWorkspace } from "@/features/migration/ExecutionWorkspace";
import { ValidationWorkspace } from "@/features/validation/ValidationWorkspace";
import type { ExecutionView, ValidationView } from "@/features/migration/state";
import { useWorkspace } from "@/app/context";
import { projectUi, type PanelId, type SidePanelTab } from "@/app/state";
import styles from "./Workspace.module.css";

import type { StageId } from "@/domain/models";
import {
  currentConversation,
  findStageConversation,
} from "@/domain/conversations";
import { stageEligibility } from "@/domain/policies";
import { Composer } from "@/features/conversations/Composer";
import { Conversation } from "@/features/conversations/Conversation";
import { AgentPanel } from "@/features/workspace/ExecutionInspector";
import { useTranslation } from "@/shared/i18n";
import { stageName } from "@/shared/i18n/stages";
import { RiskWorkspace } from "@/features/risks/RiskWorkspace";
import { WorkspaceSidePanel } from "./WorkspaceSidePanel";
import { hasRiskDecision, migrationScope } from "@/domain/assessment";
import { Icon } from "@/shared/ui/icons";
import { Button } from "@/shared/ui/primitives";
import { useState, useEffect, useRef, type CSSProperties } from "react";
import { PlanningWorkspace } from "@/features/planning/PlanningWorkspace";
import { PlanningIntake } from "@/features/planning/PlanningIntake";
import type { PlanningView } from "@/features/planning/state";
import { ManagementDiscussion } from "./ManagementDiscussion";
import { ManagementView } from "./ManagementView";
import { workspacePresentation } from "./presentation";
import { ProgressRail } from "./ProgressRail";
import { Sidebar } from "./Sidebar";
import { useWorkspaceActions } from "./useWorkspaceActions";
export function Workspace({ onSettings }: { onSettings: () => void }) {
  const t = useTranslation();
  const { data, ui, dispatchUi, conversationState } = useWorkspace();
  const s = data.snapshots[ui.selected];
  const a = useWorkspaceActions(ui.selected);
  const [inspector, setInspector] = useState(
    () => window.matchMedia("(min-width: 981px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(min-width: 981px)");
    const update = () => setInspector(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const openSidePanelButton = useRef<HTMLButtonElement>(null);
  const [riskInteractionLocked, setRiskInteractionLocked] = useState(false);
  const [sidePanelWidth, setSidePanelWidth] = useState<number>();
  const [navOpen, setNavOpen] = useState(false);
  const scrollViewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewport = scrollViewport.current;
    if (!viewport) return;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const showScrollbar = () => {
      viewport.dataset.scrolling = "true";
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => delete viewport.dataset.scrolling, 800);
    };
    viewport.addEventListener("scroll", showScrollbar, { passive: true });
    return () => {
      viewport.removeEventListener("scroll", showScrollbar);
      clearTimeout(idleTimer);
      delete viewport.dataset.scrolling;
    };
  }, []);
  const p = { ...(ui.projects[s.id] ?? projectUi()) };
  const chat =
    ([
      "planning",
      "risk",
      "tasks",
      "execution",
      "connection",
      "issues",
      "validation",
    ].includes(p.panel ?? "")
      ? findStageConversation(
          s.conversations,
          p.activeStage,
          p.lastStages[p.activeStage],
        )
      : undefined) ??
    currentConversation(s.conversations, p.conversationId, p.activeStage);
  p.conversationId = chat?.id ?? null;
  const view = conversationState[s.id]?.[p.conversationId ?? ""] ?? {
    draft: "",
  };
  const confirmation = useConversationConfirmation(s, chat?.id, view, a.view);
  const openConfirmation = (value: ConfirmationValue) => {
    if (!confirmation) {
      const issue =
        value.kind === "issue"
          ? s.execution?.issues.find((item) => item.id === value.id)
          : undefined;
      a.view({
        confirmation: value,
        ...(issue && view.issueDraft?.issueId !== issue.id
          ? {
              issueDraft: {
                issueId: issue.id,
                solution:
                  issue.solution ??
                  (issue.category === "network" ? "automatic" : "manual"),
                note: issue.note,
                simulateFailure: false,
                diagnosticFailure: "",
              },
            }
          : {}),
      });
    }
    dispatchUi({
      type: "project",
      id: s.id,
      patch: { managementChatCollapsed: false },
    });
  };
  const { stageSteps, progress } = workspacePresentation(s);
  const management = !!p.panel;
  const stage = chat?.stageId ?? p.activeStage;
  const showRail = !management && (!chat || !!chat.stageId);
  const panelScope = s.id;
  const openSidePanel = (tab: SidePanelTab) =>
    dispatchUi({
      type: "project",
      id: s.id,
      patch: {
        sidePanel: {
          tabs: [...new Set([...p.sidePanel.tabs, tab])],
          active: tab,
          open: true,
        },
      },
    });
  const canShowSidePanel = !!s.info && !management && !!chat?.stageId;
  const planningPreparing =
    chat?.stageId === "planning" && !s.planning?.batches.length;
  const hasRiskPanel = p.sidePanel.tabs.length > 0 && !planningPreparing;
  const showSidePanel = canShowSidePanel && hasRiskPanel && p.sidePanel.open;
  const showInspector = canShowSidePanel && inspector && !showSidePanel;
  const closeRiskPanel = () => {
    dispatchUi({
      type: "project",
      id: s.id,
      patch: { sidePanel: { ...p.sidePanel, open: false } },
    });
    setInspector(true);
    requestAnimationFrame(() => openSidePanelButton.current?.focus());
  };
  useEffect(() => {
    if (
      s.assessmentStatus !== "completed" ||
      chat?.stageId !== "research" ||
      management ||
      p.assessmentRiskOpened
    )
      return;
    dispatchUi({
      type: "project",
      id: s.id,
      patch: {
        assessmentRiskOpened: true,
        sidePanel: {
          tabs: [...new Set([...p.sidePanel.tabs, "risk" as const])],
          active: "risk",
          open: true,
        },
      },
    });
    setInspector(true);
  }, [
    s.id,
    s.assessmentStatus,
    chat?.stageId,
    management,
    panelScope,
    p.assessmentRiskOpened,
    p.sidePanel,
    dispatchUi,
  ]);
  useEffect(() => {
    if (
      chat?.stageId !== "planning" ||
      management ||
      p.planningOpened ||
      !s.planning?.batches.length
    )
      return;
    dispatchUi({
      type: "project",
      id: s.id,
      patch: {
        planningOpened: true,
        sidePanel: {
          tabs: [...new Set([...p.sidePanel.tabs, "planning" as const])],
          active: "planning",
          open: true,
        },
      },
    });
  }, [
    chat?.stageId,
    management,
    p.planningOpened,
    s.planning?.batches.length,
    p.sidePanel,
    s.id,
    dispatchUi,
  ]);
  useEffect(() => {
    const tab: SidePanelTab | null =
      chat?.stageId === "migration"
        ? "execution"
        : chat?.stageId === "validation"
          ? "validation"
          : null;
    if (
      !tab ||
      management ||
      (tab === "execution" ? p.executionOpened : p.validationOpened)
    )
      return;
    dispatchUi({
      type: "project",
      id: s.id,
      patch: {
        [tab === "execution" ? "executionOpened" : "validationOpened"]: true,
        sidePanel: {
          tabs: [...new Set([...p.sidePanel.tabs, tab])],
          active: tab,
          open: true,
        },
      },
    });
  }, [
    chat?.stageId,
    management,
    p.executionOpened,
    p.validationOpened,
    p.sidePanel,
    s.id,
    dispatchUi,
  ]);
  const executionViewChange = (patch: Partial<ExecutionView>) => {
    const issue = patch.issueId
      ? s.execution?.issues.find((i) => i.id === patch.issueId)
      : undefined;
    const task = issue
      ? s.execution?.tasks.find((t) => issue.taskIds.includes(t.id))
      : undefined;
    dispatchUi({
      type: "project",
      id: s.id,
      patch: {
        executionView: {
          ...p.executionView,
          ...(issue && patch.issueId !== p.executionView.issueId
            ? {
                note: issue.note,
                solution:
                  issue.solution ??
                  (issue.category === "network" ? "automatic" : "manual"),
              }
            : {}),
          ...patch,
        },
        ...(task
          ? { contextLabel: `${task.batchId} · ${task.name}` }
          : patch.batchId
            ? { contextLabel: patch.batchId }
            : {}),
      },
    });
  };
  const validationViewChange = (patch: Partial<ValidationView>) =>
    dispatchUi({
      type: "project",
      id: s.id,
      patch: { validationView: { ...p.validationView, ...patch } },
    });
  const setContext = (contextLabel: string) =>
    dispatchUi({ type: "project", id: s.id, patch: { contextLabel } });
  const setPanel = (panel: PanelId) => {
    if (["creation", "sync", "cutover"].includes(panel ?? "")) {
      panel = "tasks";
      executionViewChange({ tab: "tasks" });
    }
    dispatchUi({ type: "project", id: s.id, patch: { panel } });
    setNavOpen(false);
  };
  const chooseChat = (id: string, stageId?: StageId) => {
    a.selectConversation(id, stageId);
    setNavOpen(false);
  };
  function selectStage(id: StageId) {
    if (s.enteredStages.includes(id)) {
      const target = findStageConversation(
        s.conversations,
        id,
        p.lastStages[id],
      );
      if (target) chooseChat(target.id, id);
    } else if (stageEligibility(s)[id])
      void a.execute({ type: "stage.review", target: id });
  }
  const agent =
    view.agentId ??
    (chat?.stageId && data.catalog!.stageAgents?.[chat.stageId]) ??
    data.catalog!.defaultAgent;
  const model = view.modelId ?? data.catalog!.defaultModel;
  const conversationPanel = (panel: PanelId) => {
    if (panel === "risk") {
      if (planningPreparing) setPanel("risk");
      else openSidePanel("risk");
      setInspector(true);
      void a.send(t("查看迁移风险与处置建议"), agent, model);
    } else if (panel === "planning") {
      if (planningPreparing) void a.send(t("补充规划资料"), agent, model);
      else openSidePanel("planning");
    } else if (panel === "connection") {
      a.view({ connectionOpen: true });
      void a.send(t("修改 Migration 连接"), agent, model);
    } else if (
      [
        "execution",
        "connection",
        "issues",
        "creation",
        "sync",
        "cutover",
        "tasks",
      ].includes(panel ?? "")
    ) {
      executionViewChange({
        tab: panel === "issues" ? "issues" : "tasks",
      });
      openSidePanel("execution");
    } else if (panel === "validation") openSidePanel("validation");
    else setPanel(panel);
  };
  const order: StageId[] = ["research", "planning", "migration", "validation"];
  const next = chat?.stageId
    ? order[order.indexOf(chat.stageId) + 1]
    : undefined;
  const newProject = () =>
    dispatchUi({ type: "global", patch: { creating: true } });
  const steps = stageSteps[stage];
  const running =
    stage === "research"
      ? s.assessmentStatus === "running"
      : stage === "planning"
        ? s.planningStatus === "generating"
        : stage === "migration"
          ? s.operations["md-check"] === "running" ||
            Object.entries(s.operations).some(
              ([k, v]) => k.startsWith("execute-") && v === "running",
            )
          : false;
  const status = steps.some((v) => v.state === "blocked")
    ? "等待人工确认"
    : running
      ? "正在处理"
      : progress[stage] === 100
        ? "阶段已完成"
        : "等待下一步";
  const scopedMessages = s.messages.filter(
    (m) => m.conversationId === chat?.id && m.operation,
  );
  const planningViewChange = (patch: Partial<PlanningView>) =>
    dispatchUi({ type: "planning-view", id: s.id, patch });
  const planningDraftDirty = !!(
    p.planningView.conditionsDraft ||
    p.planningView.capacityDraft ||
    p.planningView.dependenciesDraft ||
    p.planningView.attributesDraft
  );
  const planningContent = (
    <PlanningWorkspace
      snapshot={s}
      view={p.planningView}
      onView={planningViewChange}
      onCommand={a.execute}
      onDownload={a.download}
      onUpload={a.upload}
      conversationId={chat?.id ?? null}
      onManage={() => setPanel("planning")}
      compact={!management}
    />
  );
  const planningInput = planningPreparing ? (
    <PlanningIntake
      snapshot={s}
      view={p.planningView}
      onView={planningViewChange}
      onCommand={a.execute}
      onConfirmation={(id) => openConfirmation({ kind: "planning", id })}
      onDownload={a.download}
      onUpload={a.upload}
      conversationId={chat?.id ?? null}
    />
  ) : undefined;
  const executionInput =
    !s.execution?.connection || view.connectionOpen ? (
      <ConnectionForm
        snapshot={s}
        view={p.executionView}
        sampleConnection={data.catalog?.sampleConnection}
        onView={executionViewChange}
        onCommand={a.execute}
        onDone={() => a.view({ connectionOpen: false })}
      />
    ) : undefined;
  const confirmationContent =
    confirmation && chat ? (
      <ConversationConfirmation
        key={`${s.id}-${chat.id}-${confirmation.kind}-${"id" in confirmation ? confirmation.id : confirmation.taskIds.join(",")}`}
        value={confirmation}
        onChange={(value) => a.view({ confirmation: value })}
        snapshot={s}
        conversationId={chat.id}
        executionView={{
          ...p.executionView,
          ...(confirmation.kind === "issue" ? view.issueDraft : {}),
        }}
        onExecutionView={(patch) => {
          if (confirmation.kind === "issue" && view.issueDraft)
            a.view({ issueDraft: { ...view.issueDraft, ...patch } });
          else executionViewChange(patch);
        }}
        onCommand={async (command) => {
          const ok = await a.execute(command);
          if (ok && command.type === "execution.apply")
            executionViewChange({ selected: [] });
          return ok;
        }}
        onStage={a.confirmStage}
        onUpload={a.upload}
        onDownload={a.download}
        onClose={() => a.view({ confirmation: undefined })}
      />
    ) : undefined;
  const batchId =
    p.executionView.batchId ||
    s.planning?.batches[s.execution?.sampleProgress ? 3 : 0]?.id ||
    s.planning?.batches[0]?.id;
  const selectedTaskIds = new Set(p.executionView.selected);
  const batchTasks =
    s.execution?.tasks.filter((task) =>
      selectedTaskIds.size
        ? selectedTaskIds.has(task.id)
        : task.batchId === batchId,
    ) ?? [];
  const executionPrompts =
    s.enteredStages.includes("migration") &&
    (stage === "migration" || ["tasks", "execution"].includes(p.panel ?? ""))
      ? [
          t("修改 Migration 连接"),
          ...(batchTasks.some((task) => !executionBlock(s, task, "start"))
            ? [
                selectedTaskIds.size
                  ? t("创建所选任务")
                  : t("创建 {0} 任务", batchId ?? ""),
              ]
            : []),
          ...(batchTasks.some((task) => !executionBlock(s, task, "full"))
            ? [
                selectedTaskIds.size
                  ? t("所选任务开始全量同步")
                  : t("{0} 开始全量同步", batchId ?? ""),
              ]
            : []),
          ...(batchTasks.some((task) => !executionBlock(s, task, "increment"))
            ? [
                selectedTaskIds.size
                  ? t("所选任务开始增量同步")
                  : t("{0} 开始增量同步", batchId ?? ""),
              ]
            : []),
          ...(batchTasks.some((task) => !executionBlock(s, task, "cutover"))
            ? [
                selectedTaskIds.size
                  ? t("所选任务发起割接")
                  : t("{0} 发起割接", batchId ?? ""),
              ]
            : []),
          t("查看任务状态"),
        ]
      : [];
  const executionContent = (
    <ExecutionWorkspace
      onRequest={(request) => {
        if (confirmation) return;
        if (request.kind === "connection") {
          a.view({ connectionOpen: true });
          void a.send(t("修改 Migration 连接"), agent, model);
          dispatchUi({
            type: "project",
            id: s.id,
            patch: { managementChatCollapsed: false },
          });
        } else if (request.kind === "issue") {
          executionViewChange({ issueId: request.issueId });
          openConfirmation({ kind: "issue", id: request.issueId });
        } else openConfirmation({ kind: "tasks", taskIds: request.taskIds });
      }}
      onManage={() => setPanel("tasks")}
      snapshot={s}
      view={p.executionView}
      onView={executionViewChange}
      onCommand={a.execute}
      onUpload={a.upload}
      onDownload={a.download}
      conversationId={chat?.id ?? null}
      compact={!management}
      onContext={setContext}
    />
  );
  const validationContent = (
    <ValidationWorkspace
      compact={!management}
      snapshot={s}
      view={p.validationView}
      onView={validationViewChange}
      onCommand={a.execute}
      onUpload={a.upload}
      onDownload={a.download}
      onContext={setContext}
      onReturn={() => {
        selectStage("migration");
        openSidePanel("execution");
        const current = s.execution?.tasks.find(
          (task) =>
            task.id === p.validationView.expanded ||
            p.validationView.selected.includes(task.id),
        );
        executionViewChange({
          tab: "tasks",
          batchId:
            current?.batchId ??
            (s.planning?.batches.some((b) => b.id === p.validationView.scope)
              ? p.validationView.scope
              : p.executionView.batchId),
          page: 1,
        });
      }}
    />
  );
  const executionLocation = (
    work: Extract<
      import("@/domain/models").BusinessResult,
      { kind: "execution-work" }
    >,
  ) => {
    if (confirmation && (work.view === "issues" || work.view === "connection"))
      return;
    if (work.view === "connection") {
      a.view({ connectionOpen: true });
      void a.send(t("修改 Migration 连接"), agent, model);
      return;
    }
    if (work.view === "issues" && work.issueId) {
      executionViewChange({ issueId: work.issueId });
      openConfirmation({ kind: "issue", id: work.issueId });
      return;
    }
    const task = s.execution?.tasks.find((t) => work.taskIds?.includes(t.id));
    if (work.view === "validation") {
      if (task)
        validationViewChange({
          scope: task.batchId,
          group: "batch",
          query: work.taskIds?.length === 1 ? task.name : "",
          page: 1,
        });
      if (management) setPanel("validation");
      else openSidePanel("validation");
    } else {
      executionViewChange({
        tab: work.view,
        ...(work.issueId ? { issueId: work.issueId } : {}),
        ...(task ? { batchId: task.batchId, mode: "vms", page: 1 } : {}),
      });
      if (management) setPanel("tasks");
      else openSidePanel("execution");
    }
  };
  const smallConversation = chat ? (
    <Conversation
      variant="management"
      compact
      onExecutionWork={executionLocation}
      onConfirmation={openConfirmation}
      executionInput={executionInput}
      planningDraftDirty={planningDraftDirty}
      onPlanningTimeline={() => {
        planningViewChange({ tab: "timeline" });
        setPanel("planning");
      }}
      snapshot={s}
      chat={chat}
      view={view}
      onPanel={setPanel}
      onAsk={(text) => a.send(text, agent, model)}
      onDownload={a.download}
      onCommand={a.execute}
      onStage={a.confirmStage}
      onNavigateStage={selectStage}
      onUpload={a.upload}
      onCloseWork={() => a.view({ workOpen: false })}
    />
  ) : null;
  const smallComposer = chat ? (
    <Composer
      confirmation={confirmationContent}
      executionPrompts={executionPrompts}
      compact
      catalog={data.catalog!}
      draft={view.draft}
      agentId={agent}
      modelId={model}
      busy={!!s.pending[chat.id]}
      retry={!!view.requestId && !s.pending[chat.id] && !!view.draft}
      stage={chat.stageId}
      onDraft={(draft) => a.view({ draft, requestId: undefined })}
      onAgent={(agentId) => a.view({ agentId })}
      onModel={(modelId) => a.view({ modelId })}
      onSend={(text) => a.send(text, agent, model, true)}
      onPrompt={(text) => a.send(text, agent, model)}
      attachment={view.attachment}
      onAttachment={(attachment) =>
        a.view({ attachment, requestId: undefined })
      }
      assessmentComplete={s.assessmentStatus === "completed"}
      planningGenerated={
        !!s.planning?.batches.length && s.batchConfirmation !== "confirmed"
      }
      onStop={() => void a.stop()}
      onWork={() =>
        setPanel(
          stage === "migration"
            ? "tasks"
            : stage === "validation"
              ? "validation"
              : "planning",
        )
      }
      onPanel={setPanel}
    />
  ) : null;
  return (
    <main
      style={
        sidePanelWidth === undefined
          ? undefined
          : ({ "--side-panel-size": `${sidePanelWidth}px` } as CSSProperties)
      }
      className={`${styles.root} workspace ${ui.navCollapsed ? "nav-collapsed" : ""} ${navOpen ? "nav-open" : ""} ${showInspector ? "inspector-open" : "inspector-collapsed"} ${management ? "management-view" : ""} ${showSidePanel ? "side-panel-open" : ""}`}
    >
      <a className="skip-link" href="#workspace-content">
        {t("跳转到对话")}
      </a>
      {navOpen && (
        <button
          className="nav-scrim"
          aria-label={t("关闭导航")}
          onClick={() => setNavOpen(false)}
        />
      )}
      <Sidebar
        snapshot={s}
        projects={Object.values(data.snapshots)}
        view={p}
        collapsed={ui.navCollapsed && !navOpen}
        onCollapse={() => {
          if (navOpen) setNavOpen(false);
          else
            dispatchUi({
              type: "global",
              patch: { navCollapsed: !ui.navCollapsed },
            });
        }}
        onSettings={onSettings}
        onNewProject={newProject}
        onProject={(selected) => {
          dispatchUi({ type: "global", patch: { selected } });
          setNavOpen(false);
        }}
        onNewChat={(stage) => {
          a.newConversation(stage);
          setNavOpen(false);
        }}
        onSelect={chooseChat}
        onRename={a.rename}
        onPanel={setPanel}
      />
      <section className="conversation-workspace">
        <div className="mobile-workspace-bar">
          <button
            className="icon-button"
            aria-label={t("打开导航")}
            onClick={() => setNavOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <span>{s.info?.siteName ?? t("工作空间")}</span>
        </div>
        {showRail && (
          <ProgressRail
            snapshot={s}
            stage={stage}
            progress={progress}
            onStage={selectStage}
          />
        )}
        {p.actionError && (
          <div className={styles.actionFeedback} role="alert">
            <Icon name="info" size={16} />
            <span>{t(p.actionError)}</span>
            <button
              className="icon-button"
              aria-label={t("关闭提示")}
              onClick={() => a.notify("")}
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        )}
        {chat && !management && (
          <div className="conversation-toolbar">
            <div className="conversation-context">
              <Icon name={chat.stageId ? "agent" : "chat"} size={15} />
              <span>{t(chat.title)}</span>
            </div>
            {chat.stageId &&
              !showSidePanel &&
              (hasRiskPanel || !showInspector) && (
                <button
                  ref={openSidePanelButton}
                  className="icon-button"
                  title={t(hasRiskPanel ? "展开工作区面板" : "查看执行详情")}
                  aria-label={t(
                    hasRiskPanel ? "展开工作区面板" : "查看执行详情",
                  )}
                  onClick={() =>
                    hasRiskPanel
                      ? openSidePanel(p.sidePanel.active)
                      : setInspector(true)
                  }
                >
                  <Icon name="panel" size={18} />
                </button>
              )}
          </div>
        )}
        <div
          ref={scrollViewport}
          className="conversation-scroll"
          data-auto-hide-scrollbar={!management || undefined}
          data-workbench={
            [
              "risk",
              "planning",
              "tasks",
              "execution",
              "connection",
              "issues",
              "validation",
            ].includes(p.panel ?? "") || undefined
          }
          id="workspace-content"
          tabIndex={-1}
        >
          <div
            className={`conversation-content ${management ? "has-inline-panel" : ""}`}
          >
            {management ? (
              [
                "planning",
                "risk",
                "tasks",
                "execution",
                "connection",
                "issues",
                "validation",
              ].includes(p.panel ?? "") ? (
                <ManagementDiscussion
                  key={s.id}
                  activeOperation={!!confirmation || !!view.connectionOpen}
                  agentLabel={
                    data.catalog!.agents.find((item) => item.id === agent)
                      ?.label ?? "通用智能体"
                  }
                  title={
                    t(chat?.title ?? "") === t(stageName[stage])
                      ? t(stageName[stage])
                      : `${t(stageName[stage])} · ${t(chat?.title ?? "")}`
                  }
                  contextLabel={p.contextLabel}
                  onClearContext={() => {
                    if (
                      ["tasks", "execution", "connection", "issues"].includes(
                        p.panel ?? "",
                      )
                    )
                      executionViewChange({ selected: [], batchId: "" });
                    setContext("");
                  }}
                  collapsed={p.managementChatCollapsed}
                  onCollapse={(managementChatCollapsed) =>
                    dispatchUi({
                      type: "project",
                      id: s.id,
                      patch: { managementChatCollapsed },
                    })
                  }
                  onReturn={() => {
                    if (chat) chooseChat(chat.id, chat.stageId);
                    else setPanel(null);
                  }}
                  conversation={smallConversation}
                  composer={smallComposer}
                >
                  {p.panel === "planning" ? (
                    planningContent
                  ) : ["tasks", "execution", "connection", "issues"].includes(
                      p.panel ?? "",
                    ) ? (
                    executionContent
                  ) : p.panel === "validation" ? (
                    validationContent
                  ) : (
                    <ManagementView
                      key={`${s.id}-${p.panel}`}
                      panel={p.panel}
                      snapshot={s}
                      onCommand={a.execute}
                      onClose={() => setPanel(null)}
                      onNotify={a.notify}
                      onDownload={a.download}
                      riskLocation={p.riskLocation}
                      onRiskLocation={(riskLocation) =>
                        dispatchUi({
                          type: "project",
                          id: s.id,
                          patch: { riskLocation },
                        })
                      }
                    />
                  )}
                </ManagementDiscussion>
              ) : (
                <ManagementView
                  key={`${s.id}-${p.panel}`}
                  panel={p.panel}
                  snapshot={s}
                  onCommand={a.execute}
                  onClose={() => setPanel(null)}
                  onNotify={a.notify}
                  onDownload={a.download}
                  riskLocation={p.riskLocation}
                  onRiskLocation={(riskLocation) =>
                    dispatchUi({
                      type: "project",
                      id: s.id,
                      patch: { riskLocation },
                    })
                  }
                />
              )
            ) : chat ? (
              <Conversation
                key={chat.id}
                onExecutionWork={executionLocation}
                onConfirmation={openConfirmation}
                executionInput={executionInput}
                planningInput={planningInput}
                planningDraftDirty={planningDraftDirty}
                onPlanningTimeline={() => {
                  planningViewChange({ tab: "timeline" });
                  setPanel("planning");
                }}
                snapshot={s}
                chat={chat}
                view={view}
                onPanel={conversationPanel}
                onAsk={(text) => a.send(text, agent, model)}
                onDownload={a.download}
                onCommand={a.execute}
                onStage={a.confirmStage}
                onNavigateStage={selectStage}
                onUpload={a.upload}
                onCloseWork={() => a.view({ workOpen: false })}
              />
            ) : (
              <div className="workspace-welcome">
                <Icon name="brand" size={32} />
                <h2>{t("从这里开始迁移交付")}</h2>
                <p>
                  {t("创建项目，按四个阶段推进。")}
                  <br />
                  {t("也可以先开一段聊天，理清思路。")}
                </p>
                <div>
                  <Button primary onClick={newProject}>
                    <Icon name="plus" size={17} />
                    {t("新建项目")}
                  </Button>
                  <Button onClick={() => a.newConversation()}>
                    <Icon name="chat" size={17} />
                    {t("新建聊天")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
        {chat && !management && (
          <Composer
            confirmation={confirmationContent}
            executionPrompts={executionPrompts}
            catalog={data.catalog!}
            draft={view.draft}
            agentId={agent}
            modelId={model}
            busy={!!s.pending[chat.id]}
            retry={!!view.requestId && !s.pending[chat.id] && !!view.draft}
            stage={chat.stageId}
            onDraft={(draft) => a.view({ draft, requestId: undefined })}
            onAgent={(agentId) => a.view({ agentId })}
            onModel={(modelId) => a.view({ modelId })}
            onSend={(text) => a.send(text, agent, model, true)}
            onPrompt={(text) => a.send(text, agent, model)}
            attachment={view.attachment}
            onAttachment={(attachment) =>
              a.view({ attachment, requestId: undefined })
            }
            assessmentComplete={s.assessmentStatus === "completed"}
            planningGenerated={
              !!s.planning?.batches.length &&
              s.batchConfirmation !== "confirmed"
            }
            onStop={() => void a.stop()}
            onWork={() => {
              if (chat.stageId === "research")
                void a.send(t("查看评估资料"), agent, model);
              else if (chat.stageId === "planning")
                conversationPanel("planning");
              else if (chat.stageId === "migration") openSidePanel("execution");
              else if (chat.stageId === "validation")
                openSidePanel("validation");
              else {
                a.view({ workOpen: true });
                void a.send(t("告诉我下一步该做什么"), agent, model);
              }
            }}
            onPanel={conversationPanel}
            nextLabel={
              next
                ? t(
                    s.enteredStages.includes(next)
                      ? "打开{0}"
                      : "继续下一阶段：{0}",
                    t(stageName[next]),
                  )
                : undefined
            }
            onNext={
              next
                ? () => {
                    if (s.enteredStages.includes(next)) selectStage(next);
                    else void a.execute({ type: "stage.review", target: next });
                  }
                : undefined
            }
          />
        )}
      </section>
      {canShowSidePanel && (
        <AgentPanel
          hidden={!showInspector}
          onCollapse={() => {
            setInspector(false);
            requestAnimationFrame(() => openSidePanelButton.current?.focus());
          }}
          running={running}
          status={status}
          steps={steps}
          stats={[
            {
              label: "可纳入工具迁移",
              value:
                s.assessmentStatus === "completed"
                  ? migrationScope(s).length
                  : "待评估",
              tone: "info",
            },
            {
              label: stage === "research" ? "未选策略" : "待处理风险",
              value: s.risks.filter(
                (r) => !hasRiskDecision(r) && r.stage === stage,
              ).length,
              tone: "warning",
            },
            { label: "迁移批次", value: s.batchTasks.length, tone: "info" },
            {
              label: "人工验收",
              value: `${s.validationTasks.filter((v) => v.confirmed).length} / ${s.validationTasks.length}`,
              tone: "success",
            },
          ]}
          artifacts={s.artifacts
            .filter((v) => v.stageId === stage)
            .map((v) => ({
              label: v.label,
              meta: v.filename,
              onClick: () => a.download(v.id),
            }))}
          events={scopedMessages.map((m) => ({
            text: m.text.split("\n")[0].replace(/\*\*/g, ""),
            time: m.time,
          }))}
        />
      )}
      {canShowSidePanel && hasRiskPanel && (
        <WorkspaceSidePanel
          key={panelScope}
          open={showSidePanel}
          onWidthChange={setSidePanelWidth}
          tabs={p.sidePanel.tabs}
          active={p.sidePanel.active}
          onSelect={openSidePanel}
          planning={planningContent}
          execution={executionContent}
          validation={validationContent}
          manageDisabled={
            p.sidePanel.active === "risk" && riskInteractionLocked
          }
          onManage={() =>
            dispatchUi({
              type: "project",
              id: s.id,
              patch: {
                panel:
                  p.sidePanel.active === "execution"
                    ? "tasks"
                    : p.sidePanel.active,
                riskLocation: {
                  mode: "category",
                  category: p.riskLocation.category,
                },
              },
            })
          }
          onCollapse={closeRiskPanel}
          onClose={(tab) => {
            const tabs = p.sidePanel.tabs.filter((id) => id !== tab);
            dispatchUi({
              type: "project",
              id: s.id,
              patch: {
                sidePanel: {
                  tabs,
                  active: tabs[0] ?? "risk",
                  open: tabs.length > 0,
                },
              },
            });
            if (!tabs.length) setInspector(true);
          }}
          risks={
            <RiskWorkspace
              key={s.id}
              snapshot={s}
              onCommand={a.execute}
              sidePanel
              onInteractionLockChange={setRiskInteractionLocked}
              location={p.riskLocation}
              onLocationChange={(riskLocation) =>
                dispatchUi({
                  type: "project",
                  id: s.id,
                  patch: { riskLocation },
                })
              }
              onManage={(riskLocation) =>
                dispatchUi({
                  type: "project",
                  id: s.id,
                  patch: { panel: "risk", riskLocation },
                })
              }
            />
          }
        />
      )}
    </main>
  );
}
