import { useEffect, useMemo, useRef } from "react";
import type { ProjectSnapshot } from "@/domain/models";
import type { ProjectCommand, FilePurpose } from "@/services/contracts";
import { useTranslation } from "@/shared/i18n";
import { planningPhaseLabels } from "@/shared/i18n/planning";
import { Button } from "@/shared/ui/primitives";
import { Icon } from "@/shared/ui/icons";
import { PlanningSummary } from "./PlanningSummary";
import { PlanningAssets } from "./PlanningAssets";
import type { PlanningView } from "./state";
import styles from "./Planning.module.css";

export interface PlanningWorkspaceProps {
  snapshot: ProjectSnapshot;
  view: PlanningView;
  onView: (patch: Partial<PlanningView>) => void;
  onCommand: (command: ProjectCommand) => Promise<boolean>;
  onDownload: (id: string) => void;
  onUpload: (purpose: FilePurpose, file: File) => Promise<boolean>;
  conversationId: string | null;
  compact?: boolean;
  onManage?: () => void;
  onConversation?: () => void;
}

export function PlanningWorkspace({
  snapshot: s,
  view,
  onView,
  onDownload,
  compact = false,
  onManage,
  onConversation,
}: PlanningWorkspaceProps) {
  const t = useTranslation();
  const batchList = useRef<HTMLElement>(null);
  const p = s.planning;
  const batch =
    p?.batches.find((item) => item.id === view.expandedBatch) ?? p?.batches[0];
  const assets = useMemo(() => {
    const ids = new Set(batch?.assetIds);
    return p?.assets.filter((asset) => ids.has(asset.id)) ?? [];
  }, [batch, p?.assets]);

  useEffect(() => {
    if (!compact && view.expandedBatch)
      batchList.current?.scrollIntoView({ block: "start" });
  }, [compact, view.expandedBatch]);

  function selectBatch(id: string) {
    onView({
      tab: "batches",
      expandedBatch: id,
      ...(id !== batch?.id || compact
        ? {
            query: "",
            grade: "",
            selected: [],
            assetPage: { ...view.assetPage, page: 1 },
          }
        : {}),
    });
    if (compact) onManage?.();
    else batchList.current?.scrollIntoView({ block: "start" });
  }

  if (!p?.batches.length || !s.enteredStages.includes("planning"))
    return (
      <section className={`${styles.root} ${styles.empty}`}>
        <h2>{t("迁移规划")}</h2>
        <p>{t("尚未生成规划，请在规划会话中补充资料并生成初稿。")}</p>
        {onConversation && (
          <Button onClick={onConversation}>
            {t("进入规划会话")}
            <Icon name="right" size={15} />
          </Button>
        )}
      </section>
    );

  const summary = (
    <PlanningSummary
      snapshot={s}
      onDownload={onDownload}
      onBatch={selectBatch}
      selectedBatch={compact ? undefined : batch?.id}
      standalone={!compact}
    >
      {!compact && batch && (
        <section
          ref={batchList}
          className={styles.batchList}
          aria-label={t("本批次虚拟机")}
        >
          <header className={styles.batchListHeader}>
            <h3>
              {batch.id} · {t("本批次虚拟机")}
            </h3>
            <span>
              {t(planningPhaseLabels[batch.phase])} · {assets.length} {t("台")}
            </span>
          </header>
          <p className={styles.note}>
            {t("割接窗口")}：{batch.window} · {t("割接时间")}：
            {batch.cutover.replace("T", " ")}
          </p>
          <PlanningAssets
            readOnly
            assets={assets}
            view={view}
            onView={onView}
            locked={false}
          />
        </section>
      )}
    </PlanningSummary>
  );
  if (compact) return summary;
  return (
    <section className={styles.root} aria-label={t("迁移规划工作台")}>
      <header className={styles.header}>
        <h2>{t("迁移规划")}</h2>
      </header>
      {summary}
    </section>
  );
}
