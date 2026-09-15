import type { ProjectInfo } from "@/domain/models";
import { useTranslation } from "@/shared/i18n";
import { Select } from "@/shared/ui/Select";
import { Icon } from "@/shared/ui/icons";
import { BrandName } from "@/shared/ui/BrandName";
import { useState, type FormEvent } from "react";
import styles from "./ProjectSetup.module.css";
const initialProject: ProjectInfo = {
  industry: "金融",
  region: "中国地区部",
  office: "上海代表处",
  siteName: "华东数据中心迁移",
  migrationType: "虚拟化",
};
export function ProjectSetup({
  onCreate,
  onCancel,
  busy = false,
  error,
}: {
  busy?: boolean;
  error?: string;
  onCreate: (project: ProjectInfo) => void;
  onCancel: () => void;
}) {
  const t = useTranslation();
  const [draft, setDraft] = useState<ProjectInfo>(initialProject);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (draft.office.trim() && draft.siteName.trim())
      onCreate({
        ...draft,
        office: draft.office.trim(),
        siteName: draft.siteName.trim(),
      });
  }
  return (
    <main className={`${styles.root} project-setup-page`}>
      <header>
        <span>
          <span className="huawei-symbol" role="img" aria-label={t("华为")} />
          <BrandName />
        </span>
        <button onClick={onCancel}>
          <Icon name="close" size={16} />
          {t("返回工作空间")}
        </button>
      </header>
      <form className="project-setup" onSubmit={submit}>
        <Icon name="folder" size={28} />
        <h1>{t("新建迁移项目")}</h1>
        <p>{t("先建立项目，再从调研评估开始推进交付。")}</p>
        <div className="project-form-grid">
          <label className="full-field">
            <span>{t("项目名称")}</span>
            <input
              autoFocus
              required
              maxLength={60}
              value={draft.siteName}
              onChange={(e) => setDraft({ ...draft, siteName: e.target.value })}
              placeholder={t("例如：华东数据中心迁移")}
            />
          </label>
          <label>
            <span>{t("行业")}</span>
            <Select
              aria-label={t("行业")}
              value={draft.industry}
              onValueChange={(value) => setDraft({ ...draft, industry: value })}
            >
              {["金融", "运营商", "公安", "政府", "教育"].map((item) => (
                <option key={item} value={item}>
                  {t(item)}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span>{t("迁移类型")}</span>
            <Select
              aria-label={t("迁移类型")}
              value={draft.migrationType}
              onValueChange={(value) =>
                setDraft({ ...draft, migrationType: value })
              }
            >
              {["虚拟化", "SAN", "NAS", "对象"].map((item) => (
                <option key={item} value={item}>
                  {t(item)}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span>{t("地区部")}</span>
            <Select
              aria-label={t("地区部")}
              value={draft.region}
              onValueChange={(value) => setDraft({ ...draft, region: value })}
            >
              {["中国地区部", "中亚地区部", "亚太地区部"].map((item) => (
                <option key={item} value={item}>
                  {t(item)}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span>{t("代表处")}</span>
            <input
              required
              maxLength={60}
              value={draft.office}
              onChange={(e) => setDraft({ ...draft, office: e.target.value })}
              placeholder={t("例如：上海代表处")}
            />
          </label>
        </div>
        <div className="setup-next">
          <Icon name="info" size={16} />
          <p>
            {t(
              "创建后自动开启评估会话。任务、风险、交付件和操作记录都归属当前项目。",
            )}
          </p>
        </div>
        {error && <p role="alert">{t(error)}</p>}
        <div className="setup-actions">
          <button type="button" onClick={onCancel}>
            {t("取消")}
          </button>
          <button className="primary" type="submit" disabled={busy}>
            {t("创建项目，开始评估")}
            <Icon name="right" size={16} />
          </button>
        </div>
      </form>
    </main>
  );
}
