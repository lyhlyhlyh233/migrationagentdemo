import type { PanelId, ProjectUi } from "@/app/state";
import { EMPTY_WORKSPACE_ID } from "@/domain/models";
import type {
  ProjectSnapshot,
  StageConversation,
  StageId,
} from "@/domain/models";
import { stageTitles } from "@/shared/i18n/stages";

import { useTranslation } from "@/shared/i18n";
import { Icon } from "@/shared/ui/icons";
import { ProjectResourceButton } from "@/shared/ui/ProjectResourceButton";
import { Select } from "@/shared/ui/Select";
import { StageConversationList } from "./StageNavigation";
export function Sidebar({
  snapshot: s,
  projects,
  view: p,
  collapsed,
  onCollapse,
  onSettings,
  onProject,
  onNewProject,
  onNewChat,
  onSelect,
  onRename,
  onPanel,
}: {
  snapshot: ProjectSnapshot;
  projects: ProjectSnapshot[];
  view: ProjectUi;
  collapsed: boolean;
  onCollapse: () => void;
  onSettings: () => void;
  onProject: (id: string) => void;
  onNewProject: () => void;
  onNewChat: (stage?: StageId) => void;
  onSelect: (id: string, stage?: StageId) => void;
  onRename: (id: string, title: string) => void;
  onPanel: (panel: PanelId) => void;
}) {
  const t = useTranslation();
  return (
    <>
      <aside className="nav-rail" aria-label={t("折叠导航")}>
        <button
          className="icon-button"
          aria-label={t("展开左侧菜单")}
          onClick={onCollapse}
        >
          <Icon name="sidebar" />
        </button>
        <button
          className="icon-button"
          aria-label={t("新建项目")}
          onClick={onNewProject}
        >
          <Icon name="plus" />
        </button>
        <button
          className="icon-button"
          aria-label={t("新建聊天")}
          onClick={() => onNewChat()}
        >
          <Icon name="chat" />
        </button>
        <button
          className="icon-button nav-rail-account"
          aria-label={t("打开设置")}
          onClick={onSettings}
        >
          <Icon name="settings" />
        </button>
      </aside>
      <aside
        className="workspace-nav"
        aria-label={t("项目导航")}
        inert={collapsed}
      >
        <div className="nav-platform">
          <span className="huawei-symbol" role="img" aria-label={t("华为")} />
          <h1>
            MigrationDirector <span>Plus</span>
          </h1>
          <button
            className="icon-button nav-collapse"
            aria-label={t("折叠左侧菜单")}
            onClick={onCollapse}
          >
            <Icon name="sidebar" size={17} />
          </button>
          <button
            className="icon-button nav-close"
            aria-label={t("收起导航")}
            onClick={onCollapse}
          >
            <Icon name="close" size={17} />
          </button>
        </div>
        <div className="project-switcher-row">
          <div className="project-switcher">
            <Icon name="folder" size={18} />
            <Select
              value={s.id}
              aria-label={t("切换当前项目")}
              onValueChange={onProject}
            >
              <option value={EMPTY_WORKSPACE_ID}>{t("工作空间")}</option>
              {projects
                .filter((p) => p.info)
                .map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.info!.siteName}
                  </option>
                ))}
            </Select>
          </div>
          <button
            className="icon-button"
            aria-label={t("新建项目")}
            onClick={onNewProject}
          >
            <Icon name="plus" size={18} />
          </button>
          <button
            className="icon-button"
            aria-label={t("新建聊天")}
            onClick={() => onNewChat()}
          >
            <Icon name="chat" size={18} />
          </button>
        </div>
        <div className="nav-tree-scroll">
          <nav
            className="primary-nav project-resources"
            aria-label={t("项目资料")}
          >
            {(
              [
                { id: "tasks", label: "迁移任务", icon: "tasks" },
                { id: "risk", label: "迁移风险", icon: "shield" },
                { id: "deliverables", label: "迁移交付件", icon: "file" },
                { id: "logs", label: "操作日志", icon: "clock" },
              ] as const
            ).map((item) => (
              <ProjectResourceButton
                key={item.id}
                {...item}
                selected={p.panel === item.id}
                disabled={!s.info}
                visible
                count={
                  item.id === "risk"
                    ? s.risks.filter((r) => !r.closed).length || undefined
                    : undefined
                }
                onClick={() => onPanel(item.id)}
              />
            ))}
          </nav>
          <StageConversationList
            title={stageTitles[p.activeStage]}
            conversations={
              s.conversations.filter((c) => c.stageId) as StageConversation[]
            }
            selectedId={!p.panel ? p.conversationId : null}
            disabled={!s.info}
            busyIds={Object.keys(s.pending)}
            onCreate={() => onNewChat(p.activeStage)}
            onSelect={(id) =>
              onSelect(id, s.conversations.find((c) => c.id === id)?.stageId)
            }
            onRename={onRename}
          />
          <section className="nav-section">
            <div className="nav-section-heading">
              <h2>{t("临时会话")}</h2>
              <button
                className="icon-button"
                aria-label={t("添加临时会话")}
                onClick={() => onNewChat()}
              >
                <Icon name="plus" size={15} />
              </button>
            </div>
            <nav className="temporary-conversations" aria-label={t("临时会话")}>
              {s.conversations
                .filter((c) => c.kind === "temporary")
                .map((c) => (
                  <button
                    key={c.id}
                    className={
                      p.conversationId === c.id && !p.panel ? "selected" : ""
                    }
                    onClick={() => onSelect(c.id)}
                  >
                    <Icon name="chat" size={15} />
                    <span>{t(c.title)}</span>
                  </button>
                ))}
            </nav>
            {!s.conversations.some((c) => c.kind === "temporary") && (
              <p className="nav-empty">{t("随时开启一段讨论")}</p>
            )}
          </section>
        </div>
        <div className="nav-bottom">
          <div className="user-profile">
            <span>
              <Icon name="user" size={17} />
            </span>
            <div>
              <strong>{t("当前用户")}</strong>
              <small>{t("个人账户")}</small>
            </div>
            <button
              className="icon-button account-settings"
              aria-label={t("打开设置")}
              onClick={onSettings}
            >
              <Icon name="settings" size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
