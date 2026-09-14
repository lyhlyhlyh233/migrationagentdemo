import { migrationScope, migrationMethod } from "@/domain/assessment";
import type { OperationContext } from "@/domain/models";
import type { RequestOptions } from "../contracts";
import { requireCondition } from "../errors";
import { addArtifact, workbook } from "./files";
import { buildBatchTasks, buildVmTasks, planningRisks } from "./fixtures";
import type { MockRuntime } from "./runtime";
export async function plan(
  rt: MockRuntime,
  c: OperationContext,
  filename: string,
  options: RequestOptions,
) {
  const s = rt.context(c);
  requireCondition(
    c.stageId === "planning" && s.planningStatus === "details-pending",
    "请先确认范围并补充规划信息",
  );
  await rt.run(
    c,
    "planning",
    async () => {
      rt.message(c, "user", `根据规划资料“${filename}”生成迁移批次。`, {
        operation: true,
      });
      s.planningWorkbook = filename;
      s.planningStatus = "generating";
      s.pending[c.conversationId] = {
        startedAt: Date.now(),
        runId: "planning",
      };
      rt.publish(s);
      await rt.sleep(1600, options);
      s.batchTasks = buildBatchTasks(
        migrationScope(s).map((r) => String(r[0])),
      ).filter((b) => b.vmNames.length);
      s.vmTasks = s.batchTasks
        .flatMap(buildVmTasks)
        .map((task) => ({
          ...task,
          migrationMethod: migrationMethod(s, task.name),
        }));
      s.risks = s.risks
        .filter((r) => r.stage !== "planning")
        .concat(
          structuredClone(planningRisks).map((r, index) => ({
            ...r,
            vmName:
              s.batchTasks[Math.min(index + 1, s.batchTasks.length - 1)]
                ?.vmNames[0] ?? r.vmName,
          })),
        );
      s.vmTasks.forEach(
        (v) =>
          (v.riskIds = s.risks
            .filter((r) => r.vmName === v.name)
            .map((r) => r.id)),
      );
      s.planningStatus = "completed";
      addArtifact(
        rt,
        s,
        "batch-plan",
        "迁移批次与实施计划",
        workbook([
          {
            name: "批次计划",
            rows: [
              ["批次", "虚拟机", "开始日期", "结束日期"],
              ...s.batchTasks.flatMap((b) =>
                b.vmNames.map((n) => [b.id, n, b.startDate, b.endDate]),
              ),
            ],
          },
        ]),
        "plan",
        "planning",
        "xls",
      );
      addArtifact(
        rt,
        s,
        "runbook",
        "RunBook",
        `准备：核对配置、实施窗口和回退条件。\n执行：按批次人工确认，受阻对象不创建工具任务。\n验证：对照配置和业务访问，记录验收证据。\n总体方案：${s.assessmentPlan?.note || "可迁对象免代理优先，特殊对象单独验证"}\n\n迁移约束：\n${s.risks
          .filter((r) => r.impact === "constraint")
          .map((r) => `${r.vmName}：${r.decision?.note || r.recommendation}`)
          .join("\n")}\n\n暂时排除：\n${s.risks
          .filter((r) => !migrationScope(s).some((row) => row[0] === r.vmName))
          .map((r) => `${r.vmName}：${r.description}`)
          .join("\n")}`,

        "plan",
        "planning",
      );
      rt.result(
        c,
        "批次计划已生成，受阻且未完成验证的对象已排除。你可以继续处理风险，也可以直接进入实施；任务创建前会再次按最新状态过滤。",
        [
          {
            kind: "summary",
            title: "规划设计结果",
            stageId: "planning",
            metrics: [
              { label: "迁移批次", value: s.batchTasks.length },
              { label: "规划风险", value: 4, tone: "warning" },
            ],
          },
          { kind: "artifacts", artifactIds: ["batch-plan", "runbook"] },
        ],
      );
      delete s.pending[c.conversationId];
      rt.notice(c, "规划设计完成，已生成风险、批次任务和规划产物");
    },
    options,
  );
}
