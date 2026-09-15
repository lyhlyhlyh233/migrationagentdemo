import { useTranslation } from "@/shared/i18n";
import { Icon } from "@/shared/ui/icons";
export type StepState = "done" | "active" | "waiting" | "blocked";
export interface WorkStep {
  label: string;
  detail: string;
  state: StepState;
}
export function AgentPanel({
  running,
  status,
  steps,
  stats,
  artifacts,
  events,
  hidden,
  onCollapse,
}: {
  hidden: boolean;
  onCollapse: () => void;
  running: boolean;
  status: string;
  steps: WorkStep[];
  stats: { label: string; value: string | number; tone?: string }[];
  artifacts: {
    label: string;
    meta: string;
    href?: string;
    download?: string;
    onClick?: () => void;
  }[];
  events: { text: string; time: string }[];
}) {
  const t = useTranslation();
  const completed = steps.filter((step) => step.state === "done").length;
  return (
    <aside
      hidden={hidden}
      className="agent-inspector"
      data-running={running}
      aria-label={t("执行详情")}
    >
      <header className="inspector-header">
        <span>{t("执行详情")}</span>
        <button
          type="button"
          className="icon-button"
          aria-label={t("收起执行详情")}
          title={t("收起执行详情")}
          onClick={onCollapse}
        >
          <Icon name="panel" size={18} />
        </button>
      </header>
      <div className="inspector-scroll">
        <div
          className={`state-label inspector-status ${running ? "is-active" : ""}`}
        >
          <Icon name="agent" size={16} />
          <span>{t(status)}</span>
        </div>
        <section className="inspector-section">
          <header>
            <h3>{t("执行步骤")}</h3>
            <span>
              {t(completed)} / {t(steps.length)}
            </span>
          </header>
          <div className="step-overview" aria-hidden="true">
            {steps.map((step) => (
              <span key={step.label} className={step.state} />
            ))}
          </div>
          <ol className="work-steps">
            {steps.map((step) => (
              <li key={step.label} className={step.state}>
                <span className="step-indicator">
                  {step.state === "done" ? (
                    <Icon name="check" size={12} />
                  ) : step.state === "blocked" ? (
                    "!"
                  ) : (
                    <i />
                  )}
                </span>
                <div>
                  <strong>{t(step.label)}</strong>
                  <p>{t(step.detail)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="inspector-section">
          <header>
            <h3>{t("当前统计")}</h3>
            <span>{t("随任务更新")}</span>
          </header>
          <dl className="inspector-stats">
            {stats.map((stat) => (
              <div key={stat.label} data-tone={stat.tone}>
                <dt>{t(stat.label)}</dt>
                <dd>{t(stat.value)}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="inspector-section">
          <header>
            <h3>{t("文件与产物")}</h3>
            <span>{t(artifacts.length)}</span>
          </header>
          {artifacts.length ? (
            <div className="artifact-list">
              {artifacts.map((item) =>
                item.href ? (
                  <a href={item.href} download={item.download} key={item.label}>
                    <Icon name="file" />
                    <span>
                      <strong>{t(item.label)}</strong>
                      <small>{t(item.meta)}</small>
                    </span>
                    <Icon name="download" size={15} />
                  </a>
                ) : (
                  <button key={item.label} onClick={item.onClick}>
                    <Icon name="file" />
                    <span>
                      <strong>{t(item.label)}</strong>
                      <small>{t(item.meta)}</small>
                    </span>
                    <Icon name="right" size={15} />
                  </button>
                ),
              )}
            </div>
          ) : (
            <p className="inspector-empty">
              {t("完成当前步骤后，产物会保存在这里。")}
            </p>
          )}
        </section>
        <section className="inspector-section activity-section">
          <header>
            <h3>{t("本会话活动")}</h3>
            <Icon name="clock" size={14} />
          </header>
          {events.length ? (
            events
              .slice(-3)
              .reverse()
              .map((event, index) => (
                <div className="activity-event" key={`${index}-${event.text}`}>
                  <time>{t(event.time)}</time>
                  <p>{event.text}</p>
                </div>
              ))
          ) : (
            <p className="inspector-empty">{t("等待开始当前任务。")}</p>
          )}
        </section>
      </div>
    </aside>
  );
}
