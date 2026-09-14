import { useWorkspace } from "@/app/context";
import { projectUi, type PanelId } from "@/app/state";
import styles from "./Workspace.module.css";

import { mainConversationId, type StageId } from "@/domain/models";
import { stageEligibility } from "@/domain/policies";
import { Composer } from "@/features/conversations/Composer";
import { Conversation } from "@/features/conversations/Conversation";
import { AgentPanel } from "@/features/workspace/ExecutionInspector";
import { useTranslation } from "@/shared/i18n";
import { stageTitles } from "@/shared/i18n/stages";
import { Icon } from "@/shared/ui/icons";
import { Button } from "@/shared/ui/primitives";
import { useState, useEffect } from "react";
import { ManagementView } from "./ManagementView";
import { workspacePresentation } from "./presentation";
import { ProgressRail } from "./ProgressRail";
import { Sidebar } from "./Sidebar";
import { StageHandoff } from "./StageNavigation";
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
  const [navOpen, setNavOpen] = useState(false);
  const p = { ...(ui.projects[s.id] ?? projectUi()) };
  p.conversationId ??= s.info ? mainConversationId("research") : null;
  const chat = s.conversations.find((c) => c.id === p.conversationId);
  const view = conversationState[s.id]?.[p.conversationId ?? ""] ?? {
    draft: "",
  };
  const { stageSteps, progress } = workspacePresentation(s);
  const management = !!p.panel;
  const stage = chat?.stageId ?? p.activeStage;
  const showRail = !management && (!chat || !!chat.stageId);
  const showInspector = !!s.info && !management && !!chat?.stageId && inspector;
  const setPanel = (panel: PanelId) => {
    dispatchUi({ type: "project", id: s.id, patch: { panel } });
    setNavOpen(false);
  };
  const chooseChat = (id: string, stageId?: StageId) => {
    a.selectConversation(id, stageId);
    setNavOpen(false);
  };
  function selectStage(id: StageId) {
    if (s.enteredStages.includes(id))
      chooseChat(p.lastStages[id] ?? mainConversationId(id), id);
    else if (stageEligibility(s)[id])
      dispatchUi({ type: "project", id: s.id, patch: { handoff: id } });
  }
  const agent = view.agentId ?? chat?.stageId ?? data.catalog!.defaultAgent;
  const model = view.modelId ?? data.catalog!.defaultModel;
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
      className={`${styles.root} workspace ${ui.navCollapsed ? "nav-collapsed" : ""} ${navOpen ? "nav-open" : ""} ${showInspector ? "" : "inspector-collapsed"} ${management ? "management-view" : ""}`}
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
            {chat.stageId && !showInspector && (
              <Button onClick={() => setInspector(true)}>
                {t("查看执行详情")}
              </Button>
            )}
          </div>
        )}
        <div
          className="conversation-scroll"
          id="workspace-content"
          tabIndex={-1}
        >
          <div
            className={`conversation-content ${management ? "has-inline-panel" : ""}`}
          >
            {!management && p.handoff && (
              <StageHandoff
                from={stageTitles[s.enteredStages.at(-1) ?? "research"]}
                to={stageTitles[p.handoff]}
                checks={
                  s.approvals.find((v) => v.id === `enter-${p.handoff}`)
                    ?.checks ?? []
                }
                reviewing
                onReview={() => {}}
                onCancel={() =>
                  dispatchUi({
                    type: "project",
                    id: s.id,
                    patch: { handoff: null },
                  })
                }
                onConfirm={() => a.confirmStage(p.handoff!)}
              />
            )}
            {management ? (
              <ManagementView
                key={`${s.id}-${p.panel}`}
                panel={p.panel}
                snapshot={s}
                onCommand={a.execute}
                onClose={() => setPanel(null)}
                onNotify={a.notify}
                onDownload={a.download}
              />
            ) : chat ? (
              <Conversation
                key={chat.id}
                snapshot={s}
                chat={chat}
                view={view}
                onPanel={setPanel}
                onDownload={a.download}
                onCommand={a.execute}
                onStage={a.confirmStage}
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
            onWork={() => a.view({ workOpen: true })}
            onPanel={setPanel}
          />
        )}
      </section>
      {showInspector && (
        <AgentPanel
          running={running}
          status={status}
          steps={steps}
          stats={[
            {
              label: "迁移范围",
              value: s.assessmentStatus === "completed" ? s.vmCount : "待评估",
              tone: "info",
            },
            {
              label: "待闭环风险",
              value: s.risks.filter((r) => !r.closed && r.stage === stage)
                .length,
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
          events={scopedMessages.map((m) => ({ text: m.text, time: m.time }))}
          onClose={() => setInspector(false)}
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
