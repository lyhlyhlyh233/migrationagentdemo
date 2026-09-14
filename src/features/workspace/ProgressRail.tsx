import { type ProjectSnapshot, type StageId } from "@/domain/models";
import { stageEligibility } from "@/domain/policies";
import { useTranslation } from "@/shared/i18n";
import { stageTitles } from "@/shared/i18n/stages";
import { Icon } from "@/shared/ui/icons";
import { StageFlowPreview } from "./StageNavigation";
export function ProgressRail({
  snapshot: s,
  stage,
  progress,
  onStage,
}: {
  snapshot: ProjectSnapshot;
  stage: StageId;
  progress: Record<StageId, number>;
  onStage: (id: StageId) => void;
}) {
  const t = useTranslation();
  if (!s.info || ["idle", "ready"].includes(s.assessmentStatus))
    return (
      <StageFlowPreview
        hasProject={!!s.info}
        ready={s.assessmentStatus === "ready"}
        onOpenAssessment={() => onStage("research")}
      />
    );
  const eligibility = stageEligibility(s);
  return (
    <section className="progress-rail" aria-label={t("迁移项目进度")}>
      <div className="progress-caption">
        <span>{t("四阶交付")}</span>
        <span>
          <strong>
            {Math.round(Object.values(progress).reduce((a, b) => a + b, 0) / 4)}
            %
          </strong>{" "}
          {t("本轮进度")}
        </span>
      </div>
      <ol>
        {(Object.keys(stageTitles) as StageId[]).map((id, i) => (
          <li
            key={id}
            className={`${stage === id ? "viewed-stage current" : ""} ${progress[id] === 100 ? "done" : ""}`}
          >
            <button
              disabled={!eligibility[id] && !s.enteredStages.includes(id)}
              aria-current={stage === id ? "step" : undefined}
              onClick={() => onStage(id)}
            >
              <span className="stage-sequence">
                {progress[id] === 100 ? <Icon name="check" size={12} /> : i + 1}
              </span>
              <span>{t(stageTitles[id])}</span>
              <small>
                {s.enteredStages.includes(id)
                  ? `${progress[id]}%`
                  : t(eligibility[id] ? "待确认" : "待开启")}
              </small>
            </button>
            <div
              className="stage-track"
              role="progressbar"
              aria-label={t(`${stageTitles[id]}进度`)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress[id]}
            >
              <i style={{ width: `${progress[id]}%` }} />
            </div>
            {i < 3 && (
              <span className="stage-connector" aria-hidden="true">
                <Icon name="right" size={20} />
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
