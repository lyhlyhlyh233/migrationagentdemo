import {
  businessGradeLabels,
  planningConditionFields,
} from "@/shared/i18n/planning";
import type {
  PlanningState,
  PlanningInputPatch,
  PlanningConditions,
  BusinessAttributes,
} from "@/domain/planning";

import { useTranslation } from "@/shared/i18n";
import { Button, Field } from "@/shared/ui/primitives";
import { Select } from "@/shared/ui/Select";
import { PlanningSystems } from "./PlanningSystems";
import { PlanningAssets } from "./PlanningAssets";
import type { PlanningView } from "./state";
import styles from "./Planning.module.css";
export function PlanningInputs({
  planning: p,
  view: storedView,
  onView: storeView,
  onSave,
  locked,
}: {
  planning: PlanningState;
  view: PlanningView;
  onView: (patch: Partial<PlanningView>) => void;
  onSave: (patch: PlanningInputPatch) => Promise<void>;
  locked: boolean;
}) {
  const t = useTranslation();
  const view = { ...storedView, selected: storedView.attributeSelected ?? [] };
  const onView = (patch: Partial<PlanningView>) => {
    const { selected, ...rest } = patch;
    storeView({
      ...rest,
      ...(selected ? { attributeSelected: selected } : {}),
    });
  };
  const conditions = view.conditionsDraft ?? p.conditions;
  const dependencies = view.dependenciesDraft ?? p.dependencies;
  const attributes = view.attributesDraft ?? {};
  function editConditions(key: keyof PlanningConditions, value: string) {
    onView({
      conditionsDraft: {
        ...conditions,
        [key]: typeof p.conditions[key] === "number" ? Number(value) : value,
      },
      draftRevision: view.draftRevision ?? p.revision,
    });
  }
  function editAttribute(key: keyof BusinessAttributes, value: string) {
    onView({
      attributesDraft: { ...attributes, [key]: value },
      draftRevision: view.draftRevision ?? p.revision,
    });
  }
  return (
    <>
      <nav className={styles.subtabs} aria-label={t("规划资料分类")}>
        {(
          [
            ["attributes", "业务属性"],
            ["dependencies", "业务依赖"],
            ["conditions", "迁移约束"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-current={view.section === id ? "page" : undefined}
            onClick={() => onView({ section: id })}
          >
            {t(label)}
          </button>
        ))}
      </nav>
      {view.section === "conditions" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSave({ conditions });
          }}
        >
          <div className={styles.sectionTitle}>
            <strong>{t("迁移约束")}</strong>
            <span>
              {t(
                p.conditionsSource === "sample"
                  ? "已预填示例值"
                  : "已保存项目条件",
              )}
            </span>
          </div>
          {[
            { title: "带宽", keys: ["fullBandwidth", "incrementalBandwidth"] },
            {
              title: "窗口",
              keys: ["downtime", "cutoverWindow", "validationHours"],
            },
            {
              title: "日期与并发",
              keys: ["freeze", "startDate", "concurrency"],
            },
          ].map((group) => (
            <fieldset className={styles.conditionGroup} key={group.title}>
              <legend>{t(group.title)}</legend>
              <div className={styles.fields}>
                {planningConditionFields
                  .filter(([key]) => group.keys.includes(key))
                  .map(([key, label]) => (
                    <Field
                      key={key}
                      label={t(label)}
                      type={
                        key === "startDate"
                          ? "date"
                          : typeof conditions[key] === "number"
                            ? "number"
                            : "text"
                      }
                      required={key !== "freeze"}
                      min={
                        key === "concurrency"
                          ? 1
                          : typeof conditions[key] === "number"
                            ? 0.1
                            : undefined
                      }
                      step={key === "concurrency" ? 1 : "any"}
                      disabled={locked}
                      value={conditions[key]}
                      placeholder={
                        key === "freeze"
                          ? t("例如：2026-10-01 至 2026-10-07")
                          : undefined
                      }
                      onChange={(e) => editConditions(key, e.target.value)}
                    />
                  ))}
              </div>
            </fieldset>
          ))}
          <p className={styles.note}>
            {t(
              "日期与时长用于演示，窗口和封网期仍需人工核对。业务资料可稍后补充。",
            )}
          </p>
          <div className={styles.actions}>
            <Button
              primary
              type="submit"
              disabled={locked || !view.conditionsDraft}
            >
              {t("保存条件")}
            </Button>
          </div>
        </form>
      ) : view.section === "attributes" ? (
        <>
          <p className={styles.note}>
            {t("选择虚拟机后批量填写。未修改的字段和已有单台信息保持不变。")}
          </p>
          <div
            className={styles.actions}
            role="group"
            aria-label={t("业务属性视图")}
          >
            {(
              [
                ["vms", "按虚拟机"],
                ["systems", "按业务系统"],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                aria-pressed={(view.assetMode ?? "vms") === id}
                onClick={() =>
                  onView({
                    assetMode: id,
                    systemFocus: undefined,
                    query: "",
                    grade: "",
                    assetPage: { ...view.assetPage, page: 1 },
                    selected: [],
                  })
                }
              >
                {t(label)}
              </Button>
            ))}
          </div>
          {view.assetMode === "systems" ? (
            <PlanningSystems
              assets={p.assets}
              view={view}
              onView={onView}
              locked={locked}
            />
          ) : (
            <PlanningAssets
              assets={p.assets}
              view={view}
              onView={onView}
              locked={locked}
              attributes
            />
          )}
          <form
            className={styles.editor}
            onSubmit={(e) => {
              e.preventDefault();
              void onSave({
                attributes: { assetIds: view.selected, values: attributes },
              });
            }}
          >
            <strong>
              {t("批量填写业务属性")} · {t("已选 {0} 台", view.selected.length)}
            </strong>
            <div className={styles.fields}>
              <Field
                label={t("业务系统名称")}
                value={attributes.system ?? ""}
                disabled={locked}
                placeholder={t("未填写则保持原值")}
                onChange={(e) => editAttribute("system", e.target.value)}
              />
              <label>
                <span>{t("业务等级")}</span>
                <Select
                  value={attributes.grade ?? "unchanged"}
                  disabled={locked}
                  onValueChange={(value) => editAttribute("grade", value)}
                >
                  <option value="unchanged" disabled>
                    {t("保持原值")}
                  </option>
                  {Object.entries(businessGradeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {t(label)}
                    </option>
                  ))}
                </Select>
              </label>
              <Field
                label={t("集群类型")}
                value={attributes.clusterType ?? ""}
                disabled={locked}
                placeholder={t("未填写则保持原值")}
                onChange={(e) => editAttribute("clusterType", e.target.value)}
              />
              <Field
                label={t("集群角色")}
                value={attributes.clusterRole ?? ""}
                disabled={locked}
                placeholder={t("未填写则保持原值")}
                onChange={(e) => editAttribute("clusterRole", e.target.value)}
              />
            </div>
            <Button
              primary
              type="submit"
              disabled={
                locked ||
                !view.selected.length ||
                !Object.keys(attributes).length
              }
            >
              {t("保存所选属性")}
            </Button>
          </form>
        </>
      ) : (
        <>
          <div className={styles.sectionTitle}>
            <strong>{t("业务依赖")}</strong>
            <Button
              disabled={locked}
              onClick={() =>
                onView({
                  dependenciesDraft: [
                    ...dependencies,
                    {
                      id: crypto.randomUUID(),
                      upstream: "",
                      downstream: "",
                      strength: "strong",
                      note: "",
                    },
                  ],
                  draftRevision: view.draftRevision ?? p.revision,
                })
              }
            >
              {t("新增依赖")}
            </Button>
          </div>
          <p className={styles.note}>
            {t("上游是被依赖方，下游是依赖方。未填写不代表没有依赖。")}
          </p>
          {dependencies.map((d, index) => (
            <div className={styles.dependency} key={d.id}>
              <div className={styles.fields}>
                {(
                  [
                    ["upstream", "上游系统(被依赖方)"],
                    ["downstream", "下游系统(依赖方)"],
                  ] as const
                ).map(([key, label]) => (
                  <Field
                    key={key}
                    label={t(label)}
                    disabled={locked}
                    value={d[key]}
                    onChange={(e) =>
                      onView({
                        dependenciesDraft: dependencies.map((item) =>
                          item.id === d.id
                            ? { ...item, [key]: e.target.value }
                            : item,
                        ),
                        draftRevision: view.draftRevision ?? p.revision,
                      })
                    }
                  />
                ))}
                <label>
                  <span>{t("依赖强度")}</span>
                  <Select
                    value={d.strength}
                    disabled={locked}
                    onValueChange={(strength) =>
                      onView({
                        dependenciesDraft: dependencies.map((item) =>
                          item.id === d.id
                            ? {
                                ...item,
                                strength: strength as "strong" | "weak",
                              }
                            : item,
                        ),
                        draftRevision: view.draftRevision ?? p.revision,
                      })
                    }
                  >
                    <option value="strong">{t("强依赖")}</option>
                    <option value="weak">{t("弱依赖")}</option>
                  </Select>
                </label>
                <Field
                  label={t("依赖说明")}
                  disabled={locked}
                  value={d.note}
                  onChange={(e) =>
                    onView({
                      dependenciesDraft: dependencies.map((item) =>
                        item.id === d.id
                          ? { ...item, note: e.target.value }
                          : item,
                      ),
                      draftRevision: view.draftRevision ?? p.revision,
                    })
                  }
                />
              </div>
              <Button
                disabled={locked}
                aria-label={t("删除依赖 {0}", index + 1)}
                onClick={() =>
                  onView({
                    dependenciesDraft: dependencies.filter(
                      (item) => item.id !== d.id,
                    ),
                    draftRevision: view.draftRevision ?? p.revision,
                  })
                }
              >
                {t("删除")}
              </Button>
            </div>
          ))}
          {!dependencies.length && (
            <div className={styles.empty}>{t("业务依赖待核对")}</div>
          )}
          <Button
            primary
            disabled={locked || !view.dependenciesDraft}
            onClick={() => void onSave({ dependencies })}
          >
            {t("保存依赖")}
          </Button>
        </>
      )}
    </>
  );
}
