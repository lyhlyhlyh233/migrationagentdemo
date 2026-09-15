import { useId, useState } from "react";
import type { ProjectSnapshot } from "@/domain/models";
import { hasActiveControl } from "@/domain/execution";
import type { ProjectCommand } from "@/services/contracts";
import { Button } from "@/shared/ui/primitives";
import { Icon } from "@/shared/ui/icons";
import { useTranslation } from "@/shared/i18n";
import type { ExecutionView } from "./state";
import styles from "./ConnectionForm.module.css";

export function ConnectionForm({
  snapshot,
  view,
  onView,
  onCommand,
  onDone,
}: {
  snapshot: ProjectSnapshot;
  view: ExecutionView;
  onView: (value: Partial<ExecutionView>) => void;
  onCommand: (command: ProjectCommand) => Promise<boolean>;
  onDone?: () => void;
}) {
  const t = useTranslation(),
    id = useId();
  const [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  const execution = snapshot.execution;
  if (!execution) return null;
  const values = view.connectionDraft ?? {
    ip: execution.connection?.ip ?? "",
    port: execution.connection?.port ?? 443,
    username: execution.connection?.username ?? "",
    password: "",
  };
  const checking = busy || execution.connectionStatus === "checking";
  const active =
    hasActiveControl(execution) && execution.connectionStatus === "ready";
  const field = (key: keyof typeof values, value: string) =>
    onView({
      connectionDraft: {
        ...values,
        [key]: key === "port" ? Number(value) : value,
      },
    });
  return (
    <form
      className={styles.root}
      aria-label={t("Migration 连接配置")}
      onSubmit={(event) => {
        event.preventDefault();
        if (checking || active) return;
        setBusy(true);
        setFailed(false);
        void onCommand({
          type: "execution.connection",
          values,
          simulateFailure: view.simulateFailure,
        })
          .then((ok) => {
            setFailed(!ok);
            if (ok) {
              onView({
                connectionDraft: { ...values, password: "" },
                tab: "dashboard",
              });
              onDone?.();
            }
          })
          .catch(() => setFailed(true))
          .finally(() => setBusy(false));
      }}
    >
      <div className={styles.fields}>
        <label htmlFor={`${id}-ip`}>
          Migration IP
          <input
            id={`${id}-ip`}
            disabled={checking}
            value={values.ip}
            onChange={(e) => field("ip", e.target.value)}
            placeholder="192.0.2.10"
            required
          />
        </label>
        <label htmlFor={`${id}-port`}>
          {t("端口")}
          <input
            id={`${id}-port`}
            type="number"
            min={1}
            max={65535}
            disabled={checking}
            value={values.port}
            onChange={(e) => field("port", e.target.value)}
            required
          />
        </label>
        <label htmlFor={`${id}-user`}>
          {t("用户名")}
          <input
            id={`${id}-user`}
            disabled={checking}
            value={values.username}
            autoComplete="off"
            onChange={(e) => field("username", e.target.value)}
            required
          />
        </label>
        <label htmlFor={`${id}-password`}>
          {t("密码")}
          <input
            id={`${id}-password`}
            type="password"
            disabled={checking}
            value={values.password}
            autoComplete="new-password"
            onChange={(e) => field("password", e.target.value)}
            required
          />
        </label>
      </div>
      <div className={styles.footer}>
        <span
          className={styles.status}
          data-tone={
            execution.connectionStatus === "ready" ? "success" : "muted"
          }
          role="status"
        >
          {t(
            checking
              ? "正在检测连接"
              : execution.connectionStatus === "ready"
                ? "连接可用"
                : "模拟连接，不访问真实服务",
          )}
        </span>
        <button
          type="button"
          className={styles.textButton}
          disabled={checking}
          onClick={() =>
            onView({
              connectionDraft: {
                ip: "192.0.2.10",
                port: 443,
                username: "migration-demo",
                password: "sample-only",
              },
              simulateFailure: false,
            })
          }
        >
          {t("使用样例配置")}
        </button>
        <Button
          primary
          type="submit"
          disabled={checking || active || execution.finalized}
        >
          {t(checking ? "正在检测" : "检测并应用连接")}
          <Icon name="right" size={14} />
        </Button>
      </div>
      {(failed || execution.connectionError) && (
        <p role="alert" className={styles.error}>
          {t(
            execution.connectionError ||
              "连接检测未通过，输入已保留，请修改后重试。",
          )}
        </p>
      )}
      {active && (
        <p className={styles.note}>
          {t("运行中可编辑草稿，暂停同步或等待远程操作完成后再应用。")}
        </p>
      )}
      <details className={styles.simulation}>
        <summary>{t("模拟检测选项")}</summary>
        <label>
          <input
            type="checkbox"
            checked={view.simulateFailure}
            disabled={checking}
            onChange={(e) => onView({ simulateFailure: e.target.checked })}
          />
          {t("模拟连接失败")}
        </label>
      </details>
    </form>
  );
}
