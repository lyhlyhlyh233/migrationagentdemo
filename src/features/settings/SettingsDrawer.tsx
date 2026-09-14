import {
  AccountSettings,
  NexentSettings,
  type NexentConfiguration,
} from "@/features/settings/NexentSettings";
import { ThemePicker } from "@/features/settings/ThemePicker";
import type { MigrationService } from "@/services/contracts";
import { useTranslation } from "@/shared/i18n/index";
import {
  backgrounds,
  readPreference,
  selectPreference,
  subscribePreferences,
  type Language,
} from "@/shared/preferences";
import { Select } from "@/shared/ui/Select";
import { Icon } from "@/shared/ui/icons";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import styles from "./SettingsDrawer.module.css";

export function SettingsDrawer({
  open,
  onClose,
  onSignOut,
  service,
}: {
  service: MigrationService;
  open: boolean;
  onClose: () => void;
  onSignOut: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const t = useTranslation();
  const [tab, setTab] = useState<"general" | "account">("general");
  const [configuration, setConfiguration] =
    useState<NexentConfiguration | null>(null);
  const background = useSyncExternalStore(
    subscribePreferences,
    () => readPreference("background"),
    () => "none" as const,
  );
  const language = useSyncExternalStore(
    subscribePreferences,
    () => readPreference("language"),
    () => "zh-CN" as const,
  );
  useEffect(() => {
    const element = dialog.current;
    if (open && !element?.open) {
      element?.showModal();
      if (body.current) body.current.scrollTop = 0;
    }
    if (!open && element?.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className={`${styles.root} settings-modal`}
      aria-labelledby="settings-title"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") event.stopPropagation();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="settings-drawer">
        <header className="settings-header">
          <h2 id="settings-title">{t("设置")}</h2>
          <button
            className="icon-button"
            aria-label={t("关闭设置")}
            title={t("关闭设置")}
            onClick={onClose}
          >
            <Icon name="close" size={20} />
          </button>
        </header>
        <div
          className="settings-tabs"
          role="tablist"
          aria-label={t("设置分类")}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            const next =
              event.key === "Home"
                ? "general"
                : event.key === "End"
                  ? "account"
                  : tab === "general"
                    ? "account"
                    : "general";
            setTab(next);
            event.currentTarget
              .querySelector<HTMLButtonElement>(`#settings-tab-${next}`)
              ?.focus();
            if (body.current) body.current.scrollTop = 0;
          }}
        >
          {(["general", "account"] as const).map((item) => (
            <button
              key={item}
              id={`settings-tab-${item}`}
              role="tab"
              aria-controls={`settings-panel-${item}`}
              aria-selected={tab === item}
              tabIndex={tab === item ? 0 : -1}
              onClick={() => {
                setTab(item);
                if (body.current) body.current.scrollTop = 0;
              }}
            >
              {t(item === "general" ? "通用设置" : "账户与认证")}
            </button>
          ))}
        </div>
        <div className="settings-body" ref={body}>
          <div
            role="tabpanel"
            id="settings-panel-general"
            aria-labelledby="settings-tab-general"
            hidden={tab !== "general"}
          >
            <section
              className="settings-section"
              aria-labelledby="appearance-title"
            >
              <h3 id="appearance-title">{t("外观")}</h3>
              <ThemePicker />
            </section>
            <section
              className="settings-section"
              aria-labelledby="background-title"
            >
              <div className="settings-section-heading">
                <h3 id="background-title">{t("背景")}</h3>
                <span>{t("整个工作台")}</span>
              </div>
              <div
                className="background-picker"
                role="group"
                aria-label={t("背景")}
              >
                {backgrounds.map((item) => (
                  <button
                    key={item.id}
                    className="background-option"
                    aria-label={t(`${item.label}背景`)}
                    aria-pressed={background === item.id}
                    onClick={() => selectPreference("background", item.id)}
                  >
                    <span
                      className={`background-preview background-preview-${item.id}`}
                      style={
                        item.image
                          ? { backgroundImage: `url("${item.image}")` }
                          : undefined
                      }
                      aria-hidden="true"
                    >
                      {!item.image && <Icon name="minus" size={24} />}
                      {background === item.id && (
                        <span className="background-selected">
                          <Icon name="check" size={13} />
                        </span>
                      )}
                    </span>
                    <span>{t(item.label)}</span>
                  </button>
                ))}
              </div>
            </section>
            <section
              className="settings-section language-setting"
              aria-labelledby="language-title"
            >
              <div>
                <h3 id="language-title">{t("语言")}</h3>
                <p>{t("更改界面语言，保留项目与对话原文。")}</p>
              </div>
              <Select
                aria-labelledby="language-title"
                value={language}
                onValueChange={(value) =>
                  selectPreference("language", value as Language)
                }
              >
                <option value="zh-CN">简体中文</option>
                <option value="en">English</option>
              </Select>
            </section>
          </div>
          <div
            role="tabpanel"
            id="settings-panel-account"
            aria-labelledby="settings-tab-account"
            hidden={tab !== "account"}
          >
            {open && tab === "account" && (
              <>
                <AccountSettings onSignOut={onSignOut} />
                <NexentSettings
                  configuration={configuration}
                  onChange={async (value) => {
                    await service.configureAccount(value);
                    setConfiguration(value);
                  }}
                />
              </>
            )}
          </div>
        </div>
        <footer className="settings-footer">
          <Icon name={tab === "general" ? "check" : "info"} size={14} />
          <span>
            {t(
              tab === "general"
                ? "偏好自动保存在此浏览器"
                : "认证配置需手动保存，仅在本次页面有效",
            )}
          </span>
        </footer>
      </div>
    </dialog>
  );
}
