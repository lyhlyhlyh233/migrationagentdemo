# 项目架构

MigrationDirector Ultimate 是 Vite + React + TypeScript 独立静态前端。保留一个服务契约、React Context 和三个 reducer，不引入新的状态库、依赖注入框架或流程引擎。

本文维护源码职责与修改入口；后端对接见 [接口适配说明](integration.md)，业务条件见 [业务逻辑说明](../业务逻辑说明.md)，视觉规则见 [DESIGN.md](../DESIGN.md)。

## 目录与依赖

```text
src/
  app/           入口、配置、服务装配、Provider、快照和导航状态
  domain/        模型、会话查找、阶段条件、风险和范围计算
  services/      契约、错误、唯一实现工厂、Mock、HTTP 适配模板
  features/
    workspace/   布局、导航、进度、右侧详情、操作绑定
    projects/    项目创建表单
    conversations/ 对话、结果块、输入框、快捷操作、会话草稿
    research/    评估资料输入及模板下载
    planning/    范围与规划信息表单
    migration/   MD 检查、创建/同步/割接任务视图
    validation/  配置对比和人工验收
    tasks/       任务管理和批次计划
    risks/       类别/虚拟机表、分页选择、策略编辑、右侧面板
    deliverables/ 交付件列表
    logs/        项目操作记录
    settings/    外观、背景、语言和 Nexent 配置表单
  shared/        通用 UI、国际化、偏好、本地文件保存
  styles/        基础规则、主题、全局背景和语义颜色
```

- `domain` 保持纯模型与规则，不依赖 React、服务实现或展示标签。
- `services/index.ts` 是唯一选择 Mock/HTTP 实现的位置，对外只返回 `MigrationService`。`app/config.ts` 读取公开构建配置并传给工厂，服务实现不读取 Vite 环境变量。
- `App`、`WorkspaceProvider` 和 `useWorkspaceActions` 负责装配与服务调用；展示组件接收数据和回调。设置表单只接收保存回调，不再接收整个服务对象。
- 业务执行、模拟数据和计时器集中在 `services/mock`。服务可使用纯文本翻译工具，但不导入 React 或页面。
- `eslint.config.mjs` 检查领域依赖、页面直连实现、直接 `fetch` 和服务反向导入界面。测试可导入 Mock 构造特定场景；规则不代替代码审查。

不要求每个目录都有 barrel 文件，不为单个按钮包装 service，不为现有表单再建立一套 schema 或注册系统。

## 装配与数据流

```text
app/config.ts → createServices(config) → MigrationService
                                          ↑       ↓
App / useWorkspaceActions → 命令、消息、文件       快照与事件
                                          ↓
                                  WorkspaceProvider
                                          ↓
                                  当前工作区及结果块
```

`WorkspaceProvider` 先订阅事件，再读取目录、项目列表及初始快照。初始化请求共用 AbortSignal，重试或卸载时取消；普通切页不取消业务任务。退出由 `logout` 和 `dispose` 清理本次服务生命周期，重新进入创建新服务实例。

| 状态 | 归属 | 保留范围 |
| --- | --- | --- |
| 项目资料、风险、任务、消息、等待回复、审批、文件 | 服务持有，`dataReducer` 保存只读快照 | 当前页面会话内跨项目切换 |
| 当前项目、会话、最近阶段会话、管理页、风险定位 | `uiReducer` | 按项目保存 |
| 草稿、Agent、模型、展开操作区、重试 requestId | `conversationReducer` | 按项目和会话保存 |
| 表格筛选、多选、分页、策略编辑草稿 | 功能组件局部状态 | 对应工作区挂载期间 |
| 外观、背景、语言 | `shared/preferences.ts` | 浏览器 localStorage |

`dataReducer` 忽略较旧 revision；同一项目只有服务维护执行事实，组件不能直接修改快照。只渲染当前工作区，不靠隐藏多份页面保存业务数据。

会话 ID 来自快照。`domain/conversations.ts` 负责恢复当前会话及阶段最近会话，不按阶段名称拼编号；Mock 的编号生成只在 `mock/fixtures.ts`。阶段默认 Agent 由 `Catalog.stageAgents` 提供，没有映射时使用目录默认值，阶段代码与 Agent ID 无需相同。

异步操作捕获发起项目、会话、阶段和操作标识，完成后仍写回该会话。人工交接完成时会校验等待期间的会话选择，后台任务不会强制改变当前页面。请求去重和服务端校验要求见 [接口适配说明](integration.md)。

## 功能模块边界

### 对话与结果

`Conversation` 组织回答，`ConversationAnswer` 呈现正文、思考摘要及耗时，`BusinessResults` 根据领域联合类型呈现内容。服务不返回 HTML、JSX 或组件名称。

| result.kind | 内容与状态来源 |
| --- | --- |
| assessment-input | 资料输入与上传快照，最新输入可操作，旧输入保留历史 |
| assessment-decision | 兼容旧结果的标记；快捷操作统一放在回答底部 |
| summary | 当次结论和统计快照 |
| tasks | 任务 ID，进度从当前项目快照读取 |
| artifacts | 文件资源 ID，内容由下载服务提供 |
| approval | 确认项 ID，从当前状态校验条件和是否已确认 |

普通回答可以只有文字。列表默认显示三项，可展开其余项。新增类型只修改 `BusinessResult`、服务输出及呈现分支，不增加组件注册器。历史统计不重算，资源引用读取当前内容；文件更新语义见接口说明。

### 风险、范围与表格

`RiskSidePanel`（非模态右侧面板）和 `RiskPanel`（独立管理页）是两个外壳，共用 `RiskWorkspace` 的筛选、选择与编辑状态。`Workspace` 在风险面板打开时以它替换执行详情，仍保留可操作的对话；不使用 dialog 或遮罩。面板通过原生 Pointer Capture 支持分隔线拖动及键盘调整，`Workspace` 只保存本次页面的宽度偏好，CSS 约束两侧最小宽度；不进入业务快照。

- `CategoryRiskTable`：按规则、阶段、类别和影响分组，缺失规则保持独立。
- `RiskVmTable` / `RiskVmDetails`：虚拟机子表、证据与单台例外。
- `RiskStrategyDock`：非模态策略编辑区域、标题焦点和滚动内容/固定操作按钮布局。
- `RiskBulkActions` / `RiskStrategyEditor`：上方工具栏、批量确认和可见策略选项；不嵌入表格行。
- `presentation.ts`：分组、分页定位和风险 ID 选择，使用项目全部风险计算虚拟机资格。
- `domain/risk-decisions.ts`：预览与服务共用策略判定；`mock/risk-decisions.ts` 在提交时校验最新状态并整体写入。

`ProjectUi.riskLocation` 保存当前项目的类别/虚拟机定位，不跨项目、不持久化到 URL。多选跨页跨类，过滤和查看模式变化时清空。子表分页在收起后保留，筛选变化重置；具体数量与交互见 [业务说明](../业务逻辑说明.md)。

`RiskWorkspace` 将统计/筛选、上方操作区、独立滚动列表分开；搜索作为工具栏插槽与批量按钮同行靠右，覆盖选项位于编辑区固定操作行。管理页外壳与右侧面板均提供有界高度。表格采用容器内列宽，窄屏以字段标签重排，不横向滚动。编辑只保存本次目标风险 ID，预览读取最新共享快照，提交仍走原风险命令。编辑期间冻结筛选、模式和多选范围；类别与分页浏览保持可用。取消/失败保留原选择和草稿，成功关闭编辑并清空选择，焦点返回发起入口。无需额外 Provider 或服务契约。

`domain/assessment.ts` 统一计算工具可迁范围，`policies.ts` 计算阶段条件。规划与实施调用同一范围规则；风险是否已选择策略不能代替迁移资格。人工交接仍通过 `stage.review` / `stage.confirm`，不能只改前端导航解锁阶段。

## 常见修改入口

| 修改 | 入口 |
| --- | --- |
| 后端接口、DTO、事件协议 | services/contracts.ts、services/http；先读 integration.md |
| 环境配置与服务选择 | app/config.ts、services/index.ts、.env.example |
| 示例资产、模拟回复与执行 | services/mock/fixtures、assessment-knowledge、replies、runtime |
| 菜单、折叠、会话列表 | workspace/Sidebar、StageNavigation |
| 四阶条件、进度和宽屏布局 | domain/policies、workspace/presentation、ProgressRail、Workspace.module.css |
| 回答排版、业务结果、输入框 | conversations/ConversationAnswer、BusinessResults、Composer |
| 表单内容 | research、planning、migration、validation 对应组件 |
| 表格、风险策略 | risks/RiskWorkspace、CategoryRiskTable、RiskVmTable、RiskStrategyDock、RiskStrategyEditor |
| 主题、字号、语义颜色 | styles/tokens.css、styles/index.css |
| 界面文案、阶段/状态标签 | shared/i18n/en.json、stages、status-labels |

CSS Modules 就近维护，复杂既有表格可用 Module 根节点约束内部类名；公共表格规则集中于 `ManagementView.module.css`。本次结构整理不调整界面布局或增加样式层。

运行命令见 [README](../README.md)，检查与文档维护约定见 [AGENTS.md](../AGENTS.md)。接口测试不等于真实迁移回归；本项目仍未接入后端。
