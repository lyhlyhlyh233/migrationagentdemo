import type { Artifact } from "@/domain/models";
import { useTranslation } from "@/shared/i18n";
import { Icon } from "@/shared/ui/icons";
import { Button } from "@/shared/ui/primitives";
import { EmptyState } from "@/shared/ui/Status";
export function Deliverables({
  artifacts,
  onDownload,
}: {
  artifacts: Artifact[];
  onDownload: (id: string) => void;
}) {
  const t = useTranslation();
  return (
    <section className="project-records">
      <h2>{t("迁移交付件")}</h2>
      <p>{t("各阶段生成的文件统一归档在这里。")}</p>
      {artifacts.length ? (
        artifacts.map((a) => (
          <div className="deliverable-row" key={a.id}>
            <Icon name="file" />
            <span>
              <strong>{t(a.label)}</strong>
              <small>{a.filename}</small>
            </span>
            <Button onClick={() => onDownload(a.id)}>{t("下载")}</Button>
          </div>
        ))
      ) : (
        <EmptyState
          title="还没有交付件"
          detail="完成评估后，首份报告会出现在这里。"
        />
      )}
    </section>
  );
}
