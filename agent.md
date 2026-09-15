# AI 接手入口

这是 MigrationDirector Ultimate 的独立前端。先理解现有结构，再改当前需求；不要继续扩展框架或抽象层。

## 阅读顺序

1. [AGENTS.md](AGENTS.md)：协作约定、依赖边界、检查和自动推送。
2. [README.md](README.md)：运行、配置、内网安装和部署。
3. [docs/design.md](docs/design.md)：源码职责、依赖方向、状态归属与修改入口。
4. 接口工作阅读 [docs/integration.md](docs/integration.md)：契约语义、事件、文件、取消与真实接入边界。
5. [业务逻辑说明.md](业务逻辑说明.md)：四阶条件和人工确认规则。
6. 涉及界面时阅读 [PRODUCT.md](PRODUCT.md)、[DESIGN.md](DESIGN.md)，按 Impeccable 工作流执行。

## 最短代码阅读路线

`src/app/main.tsx` → `App.tsx` / `WorkspaceProvider.tsx` → `config.ts` / `services/index.ts` → `services/contracts.ts` → `features/workspace/useWorkspaceActions.ts` → `domain/models.ts` / `policies.ts`。

业务执行位于 `services/mock/`，展示和局部草稿位于 `features/`。HTTP 模板故意未实现后端地址，切换 http 模式应显示未接入，不能伪装成成功。

`V1_0914` 是已有历史交接标签，当前代码包含之后的提交，不要移动标签。对接时优先修改适配器及必要的领域映射，不将大页面搬进另一个大 Hook，不增加流程引擎或通用注册系统。ESLint 已检查主要依赖方向。

规划改动从 `domain/planning.ts` → `services/mock/planning-data.ts` / `planning.ts` / `planning-files.ts` → `features/planning/PlanningWorkspace.tsx` 阅读。视图草稿按项目存在 `app/state.ts`；管理页小对话由 `ManagementDiscussion` 复用阶段记录。先读接口文档的规划 revision 和预览归属约定，不把 Mock 估算当成真实计算。

实施/验证从 `domain/execution.ts` → `mock/execution-state.ts` / `execution.ts` / `execution-engine.ts` → `execution-issues.ts` / `validation.ts` → `ExecutionWorkspace` / `ValidationWorkspace` 阅读。旧任务读模型由新执行状态投影，不再独立执行。实际附件在 runtime 内存，密码仅用于请求；实施安排与批准计划分离。精简规划侧面板在 `PlanningSummary`，不要再塞回完整工作台。

## 修改时必须保留

- 项目与会话隔离；切换页面不丢草稿、不串异步回复。
- 会话 ID 来自快照，阶段 Agent 来自目录；不依赖 Mock 编号。无项目空间使用 `EMPTY_WORKSPACE_ID`，不能当成真实项目提交。
- 阶段必要工作、人工交接和共享操作防重复；后台完成不强制跳转。风险决策可选，不恢复“全部确认风险才能继续”的门槛。
- `domain/assessment.ts` 统一排除受阻/未验证/本次不迁对象；跳过处置不等于风险闭环。
- 主会话带阶段引导，子会话按需展开表单。
- 历史统计快照与实时任务状态分开；旧确认项不能重复执行。
- 模型和 Agent 由服务目录提供，输入框左 Agent、右模型。
- 白/黑/绿/红主题、全局背景、中英文和手机导航。

## 模拟范围

没有真实迁移、Excel 解析、模型服务或 Nexent 登录。阶段任务通过可取消计时器模拟，回复为编写好的文案。业务数据刷新后重置，偏好持久化。不要加入密钥、虚构端点或为了演示而绕过门禁。

完成后运行 `npm run check` 和 `npm run build`（按用户要求缩小回归范围），更新受影响文档，按授权自动提交并普通推送 GitHub。只有用户要求时新增版本标签，不移动已发布标签。报告实际验证范围，不宣称完成真实业务回归。
