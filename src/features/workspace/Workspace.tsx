import { useWorkspace } from "@/app/context";
import { projectUi, type PanelId } from "@/app/state";
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
  const [riskPanel, setRiskPanel] = useState<{
    scope: string;
    open: boolean;
  }>();
  const openSidePanelButton = useRef<HTMLButtonElement>(null);
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
  const chat = currentConversation(
    s.conversations,
    p.conversationId,
    p.activeStage,
  );
  p.conversationId = chat?.id ?? null;
  const view = conversationState[s.id]?.[p.conversationId ?? ""] ?? {
    draft: "",
  };
  const { stageSteps, progress } = workspacePresentation(s);
  const management = !!p.panel;
  const stage = chat?.stageId ?? p.activeStage;
  const showRail = !management && (!chat || !!chat.stageId);
  const panelScope = `${s.id}/${chat?.id}`;
  const canShowSidePanel = !!s.info && !management && !!chat?.stageId;
  const hasRiskPanel = riskPanel?.scope === panelScope;
  const showSidePanel = canShowSidePanel && hasRiskPanel && riskPanel.open;
  const showInspector = canShowSidePanel && inspector && !showSidePanel;
  const closeRiskPanel = () => {
    setRiskPanel({ scope: panelScope, open: false });
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
      patch: { assessmentRiskOpened: true },
    });
    setRiskPanel({ scope: panelScope, open: true });
    setInspector(true);
  }, [
    s.id,
    s.assessmentStatus,
    chat?.stageId,
    management,
    panelScope,
    p.assessmentRiskOpened,
    dispatchUi,
  ]);
  const setPanel = (panel: PanelId) => {
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
      setRiskPanel({ scope: panelScope, open: true });
      setInspector(true);
      void a.send(t("查看迁移风险与处置建议"), agent, model);
    } else setPanel(panel);
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
                  title={t(hasRiskPanel ? "展开迁移风险面板" : "查看执行详情")}
                  aria-label={t(
                    hasRiskPanel ? "展开迁移风险面板" : "查看执行详情",
                  )}
                  onClick={() =>
                    hasRiskPanel
                      ? setRiskPanel({ scope: panelScope, open: true })
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
          data-risk-view={p.panel === "risk" || undefined}
          id="workspace-content"
          tabIndex={-1}
        >
          <div
            className={`conversation-content ${management ? "has-inline-panel" : ""}`}
          >
            {management ? (
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
            ) : chat ? (
              <Conversation
                key={chat.id}
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
            onSend={(text) => a.send(text, agent, model)}
            onStop={() => void a.stop()}
            onWork={() => {
              if (chat.stageId === "research")
                void a.send(t("查看评估资料"), agent, model);
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
          onCollapse={closeRiskPanel}
          onClose={closeRiskPanel}
          risks={
            <RiskWorkspace
              key={s.id}
              snapshot={s}
              onCommand={a.execute}
              sidePanel
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
      {p.notice && (
        <div className="toast" role="status">
          <Icon name="info" size={16} />
          <span>{t(p.notice)}</span>
          <button aria-label={t("关闭提示")} onClick={() => a.notify("")}>
            <Icon name="close" size={14} />
          </button>
        </div>
      )}
    </main>
  );
}
