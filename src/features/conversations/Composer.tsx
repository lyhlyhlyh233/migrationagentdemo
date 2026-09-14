import type { PanelId } from "@/app/state";
import type { Catalog, StageId } from "@/domain/models";
import {
  ShortcutMenu,
  type QuickGroup,
} from "@/features/conversations/ShortcutMenu";
import { useTranslation } from "@/shared/i18n";
import { Icon } from "@/shared/ui/icons";
import { AgentPicker } from "./AgentPicker";
import styles from "./Composer.module.css";
import { ModelPicker } from "./ModelPicker";
export function Composer({
  catalog,
  draft,
  agentId,
  modelId,
  busy,
  retry = false,
  stage,
  onDraft,
  onAgent,
  onModel,
  onSend,
  onWork,
  onPanel,
  nextLabel,
  onNext,
}: {
  nextLabel?: string;
  onNext?: () => void;
  catalog: Catalog;
  draft: string;
  agentId: string;
  modelId: string;
  busy: boolean;
  retry?: boolean;
  stage?: StageId;
  onDraft: (text: string) => void;
  onAgent: (id: string) => void;
  onModel: (id: string) => void;
  onSend: (text: string) => void;
  onWork: () => void;
  onPanel: (panel: PanelId) => void;
}) {
  const t = useTranslation();
  const workNames = {
    research: "查看评估资料",
    planning: "查看规划工作台",
    migration: "查看实施工作台",
    validation: "查看验证结果",
  };
  const groups: QuickGroup[] = stage
    ? [
        {
          label:
            stage === "research"
              ? "资料准备"
              : stage === "planning"
                ? "范围与依赖"
                : stage === "migration"
                  ? "环境检查"
                  : "配置对比",
          icon: "folder",
          options: [
            {
              label: workNames[stage],
              description: "查看当前阶段操作",
              onClick: onWork,
            },
            {
              label: "告诉我下一步该做什么",
              description: "梳理当前阶段的待办",
              onClick: () => onSend(t("告诉我下一步该做什么")),
            },
          ],
        },
        {
          label: stage === "research" ? "风险与报告" : "任务与产物",
          icon: "file",
          options: [
            {
              label: "查看迁移风险",
              description: "查询并处理当前风险",
              onClick: () => onPanel("risk"),
            },
            ...(stage === "research"
              ? [
                  {
                    label: "解读评估报告并给出建议",
                    description: "解释可行性与推荐方案",
                    onClick: () => onSend(t("解读评估报告并给出建议")),
                  },
                  {
                    label: "应用迁移有哪些限制？",
                    description: "了解应用兼容性与验证要求",
                    onClick: () => onSend(t("应用迁移有哪些限制？")),
                  },
                  {
                    label: "为什么 RDM 要考虑有代理迁移？",
                    description: "比较迁移方式与限制",
                    onClick: () => onSend(t("为什么 RDM 要考虑有代理迁移？")),
                  },
                ]
              : [
                  {
                    label: "查看迁移任务",
                    description: "查看计划与迁移任务",
                    onClick: () => onPanel("tasks"),
                  },
                ]),
            {
              label: "有哪些报告可以下载？",
              description: "查看当前阶段产物",
              onClick: () => onSend(t("有哪些报告可以下载？")),
            },
          ],
        },
      ]
    : [];
  return (
    <footer className={`${styles.root} composer-area`}>
      {retry && (
        <p role="alert" className={styles.retry}>
          {t("回复未完成，输入已保留。发送以重试。")}
        </p>
      )}
      {stage && (
        <div className={styles.topRow}>
          <div className="composer-shortcuts">
            <ShortcutMenu groups={groups} />
          </div>
          {onNext && (
            <button
              type="button"
              disabled={busy}
              className={styles.nextStage}
              onClick={onNext}
            >
              {nextLabel}
              <Icon name="right" size={15} />
            </button>
          )}
        </div>
      )}
      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          onSend(draft);
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          disabled={busy}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              if (!busy) onSend(draft);
            }
          }}
          rows={2}
          placeholder={t("描述你的任务，或选择上方快捷操作…")}
          aria-label={t("向迁移智能体提问")}
        />
        <div className="composer-bottom">
          <div className="composer-left">
            <AgentPicker
              options={catalog.agents}
              value={agentId}
              onChange={onAgent}
            />
            {stage && (
              <button
                type="button"
                className="icon-button"
                aria-label={t("查看当前阶段资料")}
                onClick={onWork}
              >
                <Icon name="plus" size={19} />
              </button>
            )}
          </div>
          <div className="composer-right">
            <ModelPicker
              options={catalog.models}
              value={modelId}
              onChange={onModel}
            />
            <button
              className="send-button"
              type="submit"
              disabled={busy || !draft.trim()}
              aria-label={t("发送消息")}
            >
              <Icon name="arrow" size={18} />
            </button>
          </div>
        </div>
      </form>
      <div className={styles.footerRow}>
        <p className="composer-note">{t("Enter 发送 · Shift + Enter 换行")}</p>
        {stage === "validation" && (
          <span className={styles.lastStage}>{t("当前为最终验证阶段")}</span>
        )}
      </div>
    </footer>
  );
}
