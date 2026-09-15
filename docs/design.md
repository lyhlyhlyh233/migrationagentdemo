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
    planning/    资料、批次、资源、时间线、调整预览与视图草稿
    migration/   连接、批次实施、诊断、预览及视图草稿
    validation/  技术核对、业务验收、反馈与最终交付
    risks/       类别/虚拟机表、分页选择、策略编辑、右侧面板
    deliverables/ 交付件列表
    logs/        项目操作记录
    settings/    外观、背景、语言和 Nexent 配置表单
  shared/        通用 UI、国际化、偏好、本地文件保存
  styles/        基础规则、主题、全局背景和语义颜色
```

- `domain` 保持纯模型与规则，不依赖 React 或服务实现；稳定代码与文案分离。
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

| 状态                                                                   | 归属                                 | 保留范围                 |
| ---------------------------------------------------------------------- | ------------------------------------ | ------------------------ |
| 项目资料、风险、任务、消息、等待回复、审批、文件                       | 服务持有，`dataReducer` 保存只读快照 | 当前页面会话内跨项目切换 |
| 当前项目、会话、最近阶段会话、管理页、面板页签、风险定位、规划视图草稿 | `uiReducer`                          | 按项目保存               |
| 草稿、Agent、模型、展开操作区、重试 requestId                          | `conversationReducer`                | 按项目和会话保存         |
| 风险筛选、多选、分页、策略编辑草稿                                     | 功能组件局部状态                     | 对应工作区挂载期间       |
| 外观、背景、语言                                                       | `shared/preferences.ts`              | 浏览器 localStorage      |

`dataReducer` 忽略较旧 revision；同一项目只有服务维护执行事实，组件不能直接修改快照。只渲染当前工作区，不靠隐藏多份页面保存业务数据。

会话 ID 来自快照。`domain/conversations.ts` 负责恢复当前会话及阶段最近会话，不按阶段名称拼编号；Mock 的编号生成只在 `mock/fixtures.ts`。阶段默认 Agent 由 `Catalog.stageAgents` 提供，没有映射时使用目录默认值，阶段代码与 Agent ID 无需相同。

异步操作捕获发起项目、会话、阶段和操作标识，完成后仍写回该会话。人工交接完成时会校验等待期间的会话选择，后台任务不会强制改变当前页面。请求去重和服务端校验要求见 [接口适配说明](integration.md)。

## 功能模块边界

### 对话与结果

`Conversation` 组织回答，`ConversationAnswer` 呈现正文、思考摘要及耗时，`BusinessResults` 根据领域联合类型呈现内容。服务不返回 HTML、JSX 或组件名称。

| result.kind         | 内容与状态来源                                               |
| ------------------- | ------------------------------------------------------------ |
| assessment-input    | 资料输入与上传快照，最新输入可操作，旧输入保留历史           |
| assessment-decision | 兼容旧结果的标记；快捷操作统一放在回答底部                   |
| planning-input      | 最新规划引导的资料、模板和生成入口；小对话只保留文字与结果   |
| execution-work      | 当前实施/验证视图与可选问题、任务 ID；仅负责定位，不直接执行 |
| planning-preview    | 待应用预览 ID，历史入口打开当前规划                          |
| summary             | 当次结论和统计快照                                           |
| tasks               | 任务 ID，进度从当前项目快照读取                              |
| artifacts           | 文件资源 ID，内容由下载服务提供                              |
| approval            | 确认项 ID，从当前状态校验条件和是否已确认                    |

普通回答可以只有文字。列表默认显示三项，可展开其余项。新增类型只修改 `BusinessResult`、服务输出及呈现分支，不增加组件注册器。历史统计不重算，资源引用读取当前内容；文件更新语义见接口说明。

### 风险、范围与表格

`ExecutionInspector` 独立呈现窄执行详情栏，不属于面板页签。规划准备阶段根据实际批次结果判断，尚无结果时保留执行详情，生成后才首次打开规划页签。`WorkspaceSidePanel` 提供可关闭的风险、规划、实施和验证页签，打开时替换执行详情；风险页签与 `RiskPanel`（独立管理页）共用 `RiskWorkspace`。同一工作区内关闭或折叠使用隐藏属性保留已挂载的风险内容，切换项目或管理页则重新建立当前面板，不缓存所有项目页面。面板通过原生 Pointer Capture 支持拖动及键盘调宽。`Workspace` 保存页面内宽度和项目内面板页签与开合状态，CSS 约束两侧最小宽度；这些状态不进入业务快照。评估完成时读取现有快照，首次返回该项目评估会话即自动展开风险；不增加服务命令、API 或重复回复。

- `CategoryRiskTable`：按规则、阶段、类别和影响分组，缺失规则保持独立。
- `RiskVmTable` / `RiskVmDetails`：虚拟机子表、证据与单台例外。
- `RiskStrategyDock`：非模态策略编辑区域、标题焦点和滚动内容/固定操作按钮布局。
- `RiskBulkActions` / `RiskStrategyEditor`：上方工具栏、批量确认和可见策略选项；批量位于顶部，单项编辑复用组件嵌入对应风险下方。
- `presentation.ts`：分组、分页定位和风险 ID 选择，使用项目全部风险计算虚拟机资格。
- `domain/risk-decisions.ts`：预览与服务共用策略判定；`mock/risk-decisions.ts` 在提交时校验最新状态并整体写入。

`ProjectUi.riskLocation` 保存当前项目的类别/虚拟机定位及可选 `sourceRiskIds` 来源范围，不跨项目、不持久化到 URL。`risksAtLocation` 将来源风险映射为虚拟机范围并保留这些虚拟机的所有风险，资格仍由完整项目快照计算；范围只有一台时自动展开，可清除定位查看全部。多选跨页跨类，过滤和查看模式变化时清空。子表分页在收起后保留，筛选变化重置；具体数量与交互见 [业务说明](../业务逻辑说明.md)。

`RiskWorkspace` 将统计/筛选、上方操作区、独立滚动列表分开；搜索作为工具栏插槽与批量按钮同行靠右，覆盖选项位于编辑区固定操作行。管理页外壳与右侧面板均提供有界高度。表格采用容器内列宽，窄屏以字段标签重排，不横向滚动。编辑保存本次目标风险 ID，预览读取最新共享快照，提交仍走原风险命令。编辑期间冻结筛选、模式和多选范围；批量编辑仍可浏览类别和分页；单项编辑固定类别与页码，同时冻结匹配记录 ID，防止其他会话更新状态后筛选移除当前编辑行。取消/失败保留原选择和草稿，成功关闭编辑并清空选择，焦点返回发起入口。无需额外 Provider 或服务契约。

`domain/assessment.ts` 统一计算工具可迁范围，`policies.ts` 计算阶段条件。规划与实施调用同一范围规则；风险是否已选择策略不能代替迁移资格。人工交接仍通过 `stage.review` / `stage.confirm`，不能只改前端导航解锁阶段。

### 实施与分批验证

`domain/execution.ts` 定义单台执行状态、操作预览、问题、技术/业务确认与反馈，集中判断控制和验收条件。`ProjectSnapshot.execution` 是唯一执行事实源；旧 `vmTasks/creationTasks/validationTasks` 只由 `mock/execution-state.ts` 投影给已有摘要，旧页面和独立计时器已删除。

- `mock/execution.ts`：连接检测、固定范围预览、原子应用及最新条件检查。
- `mock/execution-engine.ts`：每项目一个模拟循环，按并发限制推进虚拟机；图表、批次和任务读取同一状态。切页继续执行，退出清理。
- `mock/execution-issues.ts`：故障归并、日志、诊断、人工/自动方案与复查；仅用户批准后处理。
- `mock/validation.ts`：批量技术接受/业务确认、反馈、实际附件及阶段性报告。`execution-discussion.ts` 处理限定的问答和预览请求。
- `ExecutionWorkspace` 用于实施侧面板与独立任务页，`ExecutionIssues`、`ExecutionPreview` 分离诊断和确认区域；`ValidationWorkspace` 使用相同的表格、分页及主题尺寸。
- `ExecutionView`、`ValidationView` 按项目存入 `uiReducer`，保留草稿、分页和选择。连接密码仅在此内存草稿及检测请求中暂存，成功后清空；不进入服务快照。
- `PlanningSummary` 是精简侧面板，只展示摘要和当前约束/导入/预览；完整四视图仍由独立 `PlanningWorkspace` 提供，共用项目规划资料和草稿。

新能力继续走 `execute/upload/download` 与原有快照事件，不增加状态 Provider 或新的网络端点。远程执行独立于聊天 pending；停止回复仅停止生成。操作确认从当前项目资源状态校验，不按当前会话所属阶段绕过保护。具体命令和并发语义见接口说明。

## 常见修改入口

### 规划数据与工作台

`domain/planning.ts` 定义稳定资产 ID、业务属性、依赖、约束、容量、批次、预览及纯计算选择器。显示标签在 `shared/i18n/planning.ts` / `en.json`，领域不依赖界面。项目只保留一份当前计划和一份待确认调整，不新增版本库。

- `mock/planning-data.ts` 从评估范围生成示例资产，保留稳定 ID 和已有属性，初始化进入规划时的评估基线。
- `mock/planning.ts` 校验、生成、预览和应用修改，同时更新原实施任务结构。`mock/planning-files.ts` 从同一规划快照输出模板、五 Sheet 计划和 RunBook。
- `PlanningWorkspace` 装配视图与服务回调。`PlanningInputs`、`PlanningAssets` / `PlanningSystems`、`PlanningBatches`、`PlanningResources` / `PlanningTimeline`、`PlanningPreview` 分别呈现对应功能，不在组件中生成业务样例。
- `PlanningView` 通过已有 `uiReducer` 的 `planning-view` action 按项目增量保存。折叠、切页不丢资料草稿、分页和选择。表格只渲染当前页，默认 20 条，可切 50/100，不创建 1 万行 DOM。
- `WorkspaceSidePanel` 使用风险、规划、实施、验证四个明确页签，状态按项目保留，宽度保持 62∶38 默认值及原拖动规则。执行详情仍独立于页签。
- `ManagementDiscussion` 只负责宽工作台和小对话布局。`Workspace` / `useWorkspaceActions` 查找同一最近阶段会话，复用消息、输入、Agent、模型和操作上下文，不新建会话或复制消息。风险、任务和验证管理页也复用该容器；对话为约 34% / 400–720px，窄屏切换查看模式。

规划引导中的 `PlanningIntake` 复用 `PlanningInputs`、`PlanningPreview` 与项目内 `PlanningView` 草稿；由工作区通过组合传入对话结果，仅最新的规划输入/预览回答展开资料操作。折叠状态与草稿在切换管理页时保留，保存、导入和预览沿用服务命令，未扩展服务契约。

规划 revision 独立于普通聊天的项目 revision，跨会话保存必须匹配。预览固定版本、资产/批次 ID 和发起会话，失败保留输入。风险资格变化使计划待更新；待更新或待确认预览不能交接。真实适配仍须在后端实施并发校验。详细语义见 [接口说明](integration.md)。

### 其他入口

| 修改                       | 入口                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| 后端接口、DTO、事件协议    | services/contracts.ts、services/http；先读 integration.md                                 |
| 环境配置与服务选择         | app/config.ts、services/index.ts、.env.example                                            |
| 示例资产、模拟回复与执行   | services/mock/fixtures、assessment-knowledge、replies、runtime                            |
| 菜单、折叠、会话列表       | workspace/Sidebar、StageNavigation                                                        |
| 四阶条件、进度和宽屏布局   | domain/policies、workspace/presentation、ProgressRail、Workspace.module.css               |
| 回答排版、业务结果、输入框 | conversations/ConversationAnswer、BusinessResults、Composer                               |
| 表单内容                   | research、planning、migration、validation 对应组件                                        |
| 规划数据与导出             | domain/planning、mock/planning-data、mock/planning、mock/planning-files                   |
| 表格、风险策略             | risks/RiskWorkspace、CategoryRiskTable、RiskVmTable、RiskStrategyDock、RiskStrategyEditor |
| 主题、字号、语义颜色       | styles/tokens.css、styles/index.css                                                       |
| 界面文案、阶段/状态标签    | shared/i18n/en.json、stages、status-labels                                                |

CSS Modules 就近维护，复杂既有表格可用 Module 根节点约束内部类名。规划样式在 `planning/Planning.module.css`，不修改全局字号或其他管理表格列宽。

运行命令见 [README](../README.md)，检查与文档维护约定见 [AGENTS.md](../AGENTS.md)。接口测试不等于真实迁移回归；本项目仍未接入后端。
