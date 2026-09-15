import { useState } from "react";
import type { BusinessResult, ProjectSnapshot } from "@/domain/models";
import { canChangeAssessmentDecision } from "@/domain/assessment";
import type { ProjectCommand } from "@/services/contracts";
import { RiskBulkConfirmation } from "@/features/risks/RiskBulkActions";
import { useTranslation } from "@/shared/i18n";
export function RiskPromptPreview({
  result,
  snapshot,
  onCommand,
}: {
  result: Extract<BusinessResult, { kind: "risk-preview" }>;
  snapshot: ProjectSnapshot;
  onCommand: (c: ProjectCommand) => Promise<boolean>;
}) {
  const t = useTranslation();
  const [state, setState] = useState<
    "open" | "saving" | "done" | "cancelled" | "error"
  >("open");
  if (state === "done" || state === "cancelled")
    return <p>{t(state === "done" ? "策略已应用" : "已取消本次调整")}</p>;
  return (
    <section aria-label={t("风险操作预览")}>
      <RiskBulkConfirmation
        snapshot={snapshot}
        risks={snapshot.risks.filter((r) => result.riskIds.includes(r.id))}
        action={result.action}
        saving={state === "saving"}
        locked={!canChangeAssessmentDecision(snapshot)}
        feedback={state === "error" ? t("保存失败，请重试") : undefined}
        onCancel={() => setState("cancelled")}
        onSubmit={async (c) => {
          setState("saving");
          setState((await onCommand(c)) ? "done" : "error");
        }}
      />
    </section>
  );
}
