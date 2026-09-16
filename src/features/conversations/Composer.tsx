import { useRef, useState, type ReactNode } from "react";
import {
  messageAttachmentAccept,
  messageAttachmentError,
} from "@/shared/attachments";
import type { PanelId } from "@/stores/workspaceState";
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
  onStop,
  onWork,
  onPanel,
  nextLabel,
  compact = false,
  onNext,
  assessmentComplete = false,
  planningGenerated = false,
  attachment,
  onAttachment,
  onPrompt = onSend,
  confirmation,
  executionPrompts = [],
}: {
  confirmation?: ReactNode;
  executionPrompts?: string[];
  assessmentComplete?: boolean;
  planningGenerated?: boolean;
  attachment?: File;
  onAttachment?: (file?: File) => void;
  onPrompt?: (text: string) => void;
  nextLabel?: string;
  compact?: boolean;
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
  onStop: () => void;
  onWork: () => void;
  onPanel: (panel: PanelId) => void;
}) {
  const t = useTranslation();
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string>();
  const prompts =
    stage === "research" && assessmentComplete
      ? ["跳过所有高风险", "接受所有中风险", "解读剩余风险"]
      : stage === "planning" && planningGenerated
        ? [
            "将 B02 割接改到周六",
            "降低单批次并发",
            ...(catalog.capabilities?.demoTools === true
              ? ["使用样例数据调整规划"]
              : []),
          ]
        : stage === "migration" || executionPrompts.length
          ? executionPrompts
          : [];
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
              onClick: () => onPrompt(t("告诉我下一步该做什么")),
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
            ...(stage === "planning"
              ? [
                  {
                    label: "将 B02 割接改到周六",
                    description: "预览单批次窗口调整",
                    onClick: () => onPrompt(t("将 B02 割接改到周六")),
                  },
                  {
                    label: "降低单批次并发",
                    description: "预览规划约束调整",
                    onClick: () => onPrompt(t("降低单批次并发")),
                  },
                  {
                    label: "说明这个批次的安排依据",
                    description: "解释分批规则",
                    onClick: () => onPrompt(t("说明这个批次的安排依据")),
                  },
                ]
              : []),
            ...(stage === "research"
              ? [
                  {
                    label: "解读评估报告并给出建议",
                    description: "解释可行性与推荐方案",
                    onClick: () => onPrompt(t("解读评估报告并给出建议")),
                  },
                  {
                    label: "应用迁移有哪些限制？",
                    description: "了解应用兼容性与验证要求",
                    onClick: () => onPrompt(t("应用迁移有哪些限制？")),
                  },
                  {
                    label: "为什么 RDM 要考虑有代理迁移？",
                    description: "比较迁移方式与限制",
                    onClick: () => onPrompt(t("为什么 RDM 要考虑有代理迁移？")),
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
              onClick: () => onPrompt(t("有哪些报告可以下载？")),
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
      {!confirmation && ((stage && !compact) || !!prompts.length) && (
        <div className={styles.topRow}>
          <div
            className={styles.shortcutRow}
            role="group"
            aria-label={t("快捷对话")}
          >
            {stage && !compact && (
              <div className="composer-shortcuts">
                <ShortcutMenu groups={groups} />
              </div>
            )}
            {prompts.map((prompt) => (
              <button
                type="button"
                className={styles.prompt}
                key={prompt}
                disabled={busy}
                onClick={() => onPrompt(t(prompt))}
              >
                {t(prompt)}
                <Icon name="right" size={14} />
              </button>
            ))}
          </div>
          {!compact && onNext && (
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
      {fileError && (
        <p role="alert" className={styles.retry}>
          {t(fileError)}
        </p>
      )}
      {confirmation ?? (
        <form
          className="chat-composer"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) onSend(draft);
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
          {attachment && (
            <div className={styles.attachment}>
              <Icon name="file" size={15} />
              <span title={attachment.name}>{attachment.name}</span>
              <small>{t(busy ? "正在发送" : "待发送")}</small>
              <button
                type="button"
                disabled={busy}
                aria-label={t("移除附件")}
                onClick={() => onAttachment?.(undefined)}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          )}
          <div className="composer-bottom">
            <div className="composer-left">
              {onAttachment && (
                <>
                  <input
                    ref={fileInput}
                    type="file"
                    disabled={busy}
                    hidden
                    accept={messageAttachmentAccept}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      const error = messageAttachmentError(file);
                      setFileError(error);
                      if (!error) onAttachment(file);
                    }}
                  />
                  <button
                    type="button"
                    className={styles.attachButton}
                    disabled={busy}
                    aria-label={t("添加附件")}
                    title={t("添加附件 · 每条消息一个，最多 20 MB")}
                    onClick={() => fileInput.current?.click()}
                  >
                    <Icon name="attach" size={18} />
                  </button>
                </>
              )}

              <AgentPicker
                options={catalog.agents}
                value={agentId}
                onChange={onAgent}
              />
            </div>
            <div className="composer-right">
              <ModelPicker
                options={catalog.models}
                value={modelId}
                onChange={onModel}
              />
              <button
                className="send-button"
                type={busy ? "button" : "submit"}
                disabled={!busy && !draft.trim() && !attachment}
                aria-label={t(busy ? "停止回复" : "发送消息")}
                title={t(busy ? "停止回复" : "发送消息")}
                onClick={busy ? onStop : undefined}
              >
                {busy ? (
                  <span className={styles.stopIcon} aria-hidden="true" />
                ) : (
                  <Icon name="arrow" size={18} />
                )}
              </button>
            </div>
          </div>
        </form>
      )}
      {!compact && !confirmation && (
        <div className={styles.footerRow}>
          <p className="composer-note">
            {t("Enter 发送 · Shift + Enter 换行")}
          </p>
          {stage === "validation" && (
            <span className={styles.lastStage}>{t("当前为最终验证阶段")}</span>
          )}
        </div>
      )}
    </footer>
  );
}
