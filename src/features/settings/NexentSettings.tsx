import { useTranslation } from "@/shared/i18n/index";
import { Icon } from "@/shared/ui/icons";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { useRef, useState, type FormEvent } from "react";

import type { AccountState, NexentConfiguration } from "@/domain/models";
import { errorMessage } from "@/services/errors";
export type { NexentConfiguration } from "@/domain/models";

type Draft = {
  method: NexentConfiguration["method"];
  apiKey: string;
  username: string;
  password: string;
};
type Field = "apiKey" | "username" | "password";
const emptyDraft: Draft = {
  method: "api-key",
  apiKey: "",
  username: "",
  password: "",
};

export function NexentSettings({
  account,
  demoTools,
  onChange,
}: {
  account: AccountState;
  demoTools: boolean;
  onChange: (value: NexentConfiguration | null) => Promise<AccountState>;
}) {
  const t = useTranslation();
  const form = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState<Draft>(() => ({
    ...emptyDraft,
    method: account.method ?? emptyDraft.method,
  }));
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [revealed, setRevealed] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  function saved(result: AccountState) {
    setDraft({ ...emptyDraft, method: result.method ?? draft.method });
    setErrors({});
    setRevealed(false);
    setNotice(
      result.configured
        ? result.verified
          ? "配置已保存，连接已验证。"
          : "配置已保存，尚未验证连接。"
        : "认证配置已清除。",
    );
  }

  function change(field: Field, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setNotice("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const nextErrors: Partial<Record<Field, string>> = {};
    if (draft.method === "api-key" && !draft.apiKey.trim())
      nextErrors.apiKey = "请输入 API Key。";
    else if (draft.method === "api-key" && /\s/.test(draft.apiKey.trim()))
      nextErrors.apiKey = "API Key 不能包含空格或其他空白字符。";
    if (draft.method === "account") {
      if (!draft.username.trim()) nextErrors.username = "请输入平台账号。";
      if (!draft.password.trim()) nextErrors.password = "请输入平台密码。";
    }
    setErrors(nextErrors);
    setNotice("");
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      form.current
        ?.querySelector<HTMLInputElement>(`[name="${firstError}"]`)
        ?.focus();
      return;
    }
    setBusy(true);
    try {
      const result = await onChange(
        draft.method === "api-key"
          ? { method: "api-key", apiKey: draft.apiKey.trim() }
          : {
              method: "account",
              username: draft.username.trim(),
              password: draft.password,
            },
      );
      saved(result);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      saved(await onChange(null));
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const secretField = draft.method === "api-key" ? "apiKey" : "password";
  const secretLabel = draft.method === "api-key" ? "API Key" : "平台密码";
  const dirty =
    Boolean(draft.apiKey || draft.username || draft.password) ||
    (account.configured && account.method !== draft.method);
  return (
    <section
      className="settings-section nexent-settings"
      aria-labelledby="nexent-title"
    >
      <div className="settings-section-heading">
        <h3 id="nexent-title">{t("Nexent 平台认证")}</h3>
        <span>
          {t(
            dirty
              ? "待保存"
              : account.configured
                ? account.verified
                  ? "已配置 · 已验证"
                  : "已配置 · 未验证"
                : "未配置",
          )}
        </span>
      </div>
      <p className="settings-description" id="nexent-preview-note">
        {t(
          demoTools
            ? "配置仅在当前页面保留，尚未连接 Nexent 服务。"
            : "认证状态由服务返回，保存后清空本次输入的凭据。",
        )}
      </p>
      <form
        ref={form}
        onSubmit={save}
        noValidate
        autoComplete="off"
        aria-busy={busy}
        aria-describedby="nexent-preview-note"
      >
        <fieldset
          className="authentication-method"
          disabled={busy}
          aria-describedby="nexent-method-tip"
        >
          <legend>{t("认证方式")}</legend>
          <div className="authentication-options">
            {(["api-key", "account"] as const).map((method) => (
              <label key={method} data-selected={draft.method === method}>
                <input
                  type="radio"
                  name="nexent-method"
                  value={method}
                  checked={draft.method === method}
                  onChange={() => {
                    setDraft((current) => ({
                      ...current,
                      method,
                      apiKey: "",
                      password: "",
                    }));
                    setErrors({});
                    setRevealed(false);
                    setNotice("");
                  }}
                />
                <Icon name={method === "api-key" ? "key" : "user"} size={16} />
                <span>{t(method === "api-key" ? "API Key" : "账号密码")}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="authentication-tip" id="nexent-method-tip">
          <Icon name="info" size={15} />
          <span>
            {t(
              draft.method === "api-key"
                ? "使用已有的 Nexent API Key，无需填写平台账号密码。"
                : "使用已有的 Nexent 平台账号和密码，此处不会创建新账号。",
            )}
          </span>
        </p>
        {draft.method === "account" && (
          <div className="settings-field">
            <label htmlFor="nexent-username">{t("平台账号")}</label>
            <input
              id="nexent-username"
              name="username"
              required
              disabled={busy}
              value={draft.username}
              onChange={(event) => change("username", event.target.value)}
              placeholder={t("输入 Nexent 平台账号")}
              spellCheck={false}
              autoCapitalize="none"
              aria-invalid={Boolean(errors.username)}
              aria-describedby={`nexent-username-hint${errors.username ? " nexent-username-error" : ""}`}
            />
            <p className="settings-field-hint" id="nexent-username-hint">
              {t("必填，填写完整平台账号；首尾空格会自动移除。")}
            </p>
            {errors.username && (
              <p className="settings-field-error" id="nexent-username-error">
                {t(errors.username)}
              </p>
            )}
          </div>
        )}
        <div className="settings-field">
          <label htmlFor="nexent-secret">{t(secretLabel)}</label>
          <div className="settings-secret">
            <input
              id="nexent-secret"
              name={secretField}
              type={revealed ? "text" : "password"}
              required
              disabled={busy}
              value={draft[secretField]}
              onChange={(event) => change(secretField, event.target.value)}
              placeholder={t(
                draft.method === "api-key"
                  ? "粘贴完整 API Key"
                  : "输入平台密码",
              )}
              spellCheck={false}
              autoCapitalize="none"
              aria-invalid={Boolean(errors[secretField])}
              aria-describedby={`nexent-secret-hint${errors[secretField] ? " nexent-secret-error" : ""}`}
            />
            <button
              type="button"
              className="icon-button"
              aria-label={t(revealed ? "隐藏凭据" : "显示凭据")}
              aria-pressed={revealed}
              disabled={busy}
              onClick={() => setRevealed(!revealed)}
            >
              <Icon name={revealed ? "eye-off" : "eye"} size={18} />
            </button>
          </div>
          <p className="settings-field-hint" id="nexent-secret-hint">
            {t(
              draft.method === "api-key"
                ? "必填，首尾空格自动移除；内容不能包含空格或其他空白字符。"
                : "必填，不能全为空格；大小写和首尾空格均按原样保留。",
            )}
          </p>
          {errors[secretField] && (
            <p className="settings-field-error" id="nexent-secret-error">
              {t(errors[secretField])}
            </p>
          )}
        </div>
        <div className="settings-form-actions">
          <button
            type="button"
            disabled={busy || !account.configured}
            onClick={clear}
          >
            {t("清除配置")}
          </button>
          <button type="submit" className="primary" disabled={busy}>
            {t(busy ? "正在保存…" : "保存配置")}
          </button>
        </div>
        <p className="settings-save-status" role="status">
          {t(notice)}
        </p>
      </form>
    </section>
  );
}

export function AccountSettings({ onSignOut }: { onSignOut: () => void }) {
  const t = useTranslation();
  const [confirming, setConfirming] = useState(false);
  return (
    <section
      className="settings-section settings-account"
      aria-labelledby="account-title"
    >
      <h3 id="account-title">{t("当前账户")}</h3>
      <div className="settings-account-row">
        <span className="settings-avatar">
          <UserAvatar />
        </span>
        <div>
          <strong>{t("当前用户")}</strong>
          <span>{t("个人账户")}</span>
        </div>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-expanded={confirming}
          aria-controls="sign-out-review"
        >
          <Icon name="logout" size={16} />
          {t("退出登录")}
        </button>
      </div>
      {confirming && (
        <div className="sign-out-review" id="sign-out-review">
          <p>
            {t("退出将清除本次页面的项目、会话和认证配置，外观偏好会保留。")}
          </p>
          <div>
            <button onClick={() => setConfirming(false)}>{t("取消")}</button>
            <button className="primary" onClick={onSignOut}>
              {t("确认退出")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
