import { useState, type ReactNode } from "react";
import { Button } from "@/shared/ui/primitives";
import { Icon } from "@/shared/ui/icons";
import { useTranslation } from "@/shared/i18n";
import styles from "./ManagementDiscussion.module.css";
export function ManagementDiscussion({
  children,
  conversation,
  composer,
  title,
  collapsed,
  onCollapse,
  onReturn,
}: {
  children: ReactNode;
  conversation: ReactNode;
  composer: ReactNode;
  title: string;
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
  onReturn: () => void;
}) {
  const t = useTranslation();
  const [mobileChat, setMobileChat] = useState(false);
  return (
    <div
      className={styles.root}
      data-collapsed={collapsed || undefined}
      data-mobile-chat={mobileChat || undefined}
    >
      <div className={styles.toolbar}>
        <Button onClick={onReturn}>{t("返回阶段会话")}</Button>
        <Button
          onClick={() => {
            if (window.matchMedia("(max-width: 1100px)").matches) {
              setMobileChat(!mobileChat);
              onCollapse(false);
            } else onCollapse(!collapsed);
          }}
        >
          <Icon name="chat" size={15} />
          {t(
            mobileChat ? "查看工作台" : collapsed ? "展开讨论" : "讨论当前页面",
          )}
        </Button>
      </div>
      <div className={styles.content}>{children}</div>
      {!collapsed && (
        <aside className={styles.chat} aria-label={t("工作台对话")}>
          <header>
            <div>
              <strong>{t("当前阶段会话")}</strong>
              <span>{title}</span>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label={t("折叠工作台对话")}
              onClick={() => {
                onCollapse(true);
                setMobileChat(false);
              }}
            >
              <Icon name="panel" size={16} />
            </button>
          </header>
          <div className={styles.messages}>{conversation}</div>
          {composer}
        </aside>
      )}
    </div>
  );
}
