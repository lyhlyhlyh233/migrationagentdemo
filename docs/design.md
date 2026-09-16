# 项目架构

MigrationDirector Ultimate 是 Vite + React + TypeScript 独立静态前端。服务契约隔离 UI 与执行实现，Zustand 管理公共状态；不增加流程引擎或组件注册器。

本文维护源码职责与修改入口；后端对接见 [接口适配说明](integration.md)，业务条件见 [业务逻辑说明](../业务逻辑说明.md)，视觉规则见 [DESIGN.md](../DESIGN.md)。

## 目录与依赖

```text
src/
  app/           入口、公开配置、服务装配、薄 Provider、会话订阅桥接
  stores/        Zustand 工作区与偏好 store，公共状态类型及纯 reducer
  domain/        模型、会话查找、阶段条件、风险和范围计算
  services/      契约、错误、唯一实现工厂、Mock、HTTP 适配模板
  features/
    workspace/   对话布局、项目/会话导航、进度、侧面板、操作绑定
    projects/    项目创建表单
    conversations/ 对话、结果块、输入框、快捷操作与确认区
    research/    评估资料输入及模板下载
    planning/    对话资料、约束、规划结论、时间线与调整预览
    migration/   对话连接、实施看板、诊断与操作预览
    validation/  技术核对、业务验收、反馈与最终交付
    risks/       类别表、批量选择、策略编辑与风险概览
    settings/    外观、背景、语言及 Nexent 认证表单
  shared/        通用 UI、国际化、偏好配置、本地文件保存
  styles/        基础规则、主题、全局背景和语义颜色
```

- `domain` 保持纯模型与规则，不依赖 React、store 或服务实现；稳定代码与展示标签分离。
- `services/index.ts` 是唯一实现工厂，对外只返回 `MigrationService`。`app/config.ts` 读取公开构建配置，DTO、地址、认证和事件协议仅在适配器转换。
- `stores` 管公共数据和 UI 状态，不生成业务任务，不调用具体 Mock/HTTP 实现。状态类型位于 `workspaceState/conversationState/planningState/executionState/riskState`，避免公共层反向依赖 feature。
- `App`、`app/workspaceSession.ts` 和 `useWorkspaceActions` 绑定服务；展示组件接收数据和回调。服务不导入 React 或页面，不向 UI 返回 HTML/JSX。
- 业务执行、模拟数据和计时器集中在 `services/mock`。`eslint.config.mjs` 约束依赖方向、页面直连实现和直接 `fetch`；测试可导入 Mock 构造场景。

不要求每个目录都有 barrel 文件，不为单个按钮包装 service，不建立通用流程引擎或新的网络层。

## 装配与数据流

```text
app/config.ts → createServices(config) → MigrationService
App / useWorkspaceActions ────────────────↑       ↓
                                         命令    快照、通知、账户状态
                                                  ↓
                                      app/workspaceSession.ts
                                                  ↓
                                        stores/workspaceStore
                                                  ↓
                                   useWorkspace(selector) → UI
```

`WorkspaceProvider` 为当前登录会话创建 store，用稳定 Context 注入 store、service 和 retry；Context 不承载整包变化状态。`useWorkspace(selector)` 订阅所需状态，`useWorkspaceSession()` 提供服务会话能力。服务和 store 都由对应 effect 创建并清理；服务替换或开发模式 effect 重放会创建新实例，普通重渲染保留现有实例。退出销毁旧会话，迟到回调不能写入已结束会话。

`connectWorkspace` 先订阅，再读取目录、项目列表、初始快照和脱敏账户状态。初始化共用 AbortSignal，重试或卸载取消旧读取；普通项目/会话切换不停止业务任务。快照按 revision 忽略旧版本。notice/error 带会话 ID 时写回对应会话提示，否则归所属项目，不抢占当前会话。服务 `logout/dispose` 负责请求、执行等待、文件和连接清理。

| 状态                                                   | 归属                                   | 保留范围                     |
| ------------------------------------------------------ | -------------------------------------- | ---------------------------- |
| 项目资料、风险、任务、消息、审批、文件                 | 服务持有，workspace store 缓存只读快照 | 本次登录会话                 |
| 当前项目、阶段、最近会话、面板页签、规划/实施/验证视图 | workspace store 的 ui                  | 按项目                       |
| 普通草稿、File、Agent/模型、确认引用、requestId、通知  | workspace store 的 conversationState   | 按项目和会话                 |
| 认证配置/验证状态与认证方式                            | workspace store 的 AccountState        | 本次登录会话，不含秘密       |
| 风险筛选、多选、策略草稿、面板宽度、单组件展开及 busy  | 对应功能组件                           | 所属挂载期间；面板折叠保留   |
| API Key、账户密码、连接密码                            | 提交表单局部状态                       | 成功清空，失败保留，卸载清除 |
| 主题、背景、语言                                       | preferencesStore                       | 沿用既有 localStorage 键     |

`preferencesStore` 是偏好的唯一运行时状态源；`shared/preferences.ts` 提供现有调用入口，DOM 的 lang/data 属性只是渲染镜像。`startPreferenceSync()` 在 React 挂载前恢复首屏偏好，并监听 storage 跨标签同步。只有偏好持久化，业务快照、草稿、File 和凭据不写浏览器持久存储。

会话 ID 来自服务快照，`domain/conversations.ts` 查找当前/最近阶段会话，阶段 Agent 来自目录映射。异步操作固定发起项目、会话、阶段和操作标识；新建会话与阶段交接完成仅在原会话选择未改变时更新导航，也保护尚未显式选择会话的初始状态。后台完成可更新所属项目快照，不抢占当前可见会话。

## 界面范围

工作区只由中央对话、执行详情及现有风险/规划/实施/验证侧面板组成。迁移风险、迁移规划、迁移任务、迁移交付件、操作日志的独立页面及入口已移除；没有替代路由或新的管理页容器。

独立页专属的风险虚拟机视图/子表、单台例外和核验入口、规划批次资产列表、全量交付件列表与项目操作日志列表不迁入面板。已有对话交付文件、看板/诊断日志下载、输入框确认及执行详情最近活动保留。删除展示入口不删除仍被对话使用的领域数据或服务契约。

`WorkspaceSidePanel` 负责四类可关闭页签、拖动和键盘调宽。打开侧面板替换窄执行详情，关闭或折叠恢复详情；风险内容在同一工作区折叠时保留挂载。评估完成自动展开风险一次；规划尚未生成时保留详情，生成后首次展开规划。面板状态不进入业务快照。

## 功能模块

### 对话与确认

`Conversation` 组织回答，`ConversationAnswer` 呈现正文、思考摘要及耗时，`BusinessResults` 根据领域联合类型呈现资料、统计、文件和资源引用。历史统计保留当次值；任务、文件、审批和预览按 ID 读取当前资源。

`useConversationConfirmation` 只处理本会话明确的预览/审批结果。`ConversationConfirmation` 在输入框位置复用规划预览、实施预览、单问题编辑及阶段交接；当前只显示一个确认区，后台结果不替换未完成输入。取消/完成恢复普通草稿与 File。`ConfirmationChoices` 仅复用编号选项、推荐标识和备注输入，不承载执行逻辑。

所有实际动作沿用 `execute/upload/download/sendMessage`。确认选择与备注按项目/会话保存；服务继续校验资源归属、执行锁、版本和人工确认，不以界面可见性代替授权。

### 风险与范围

`RiskWorkspace` 仅服务现有风险侧面板，组合 `RiskOverview`、类别筛选、`CategoryRiskTable`、`RiskBulkActions` 和策略编辑。数量为只读统计，不再跳到独立 VM 页面。单项策略嵌在事项下方，批量策略位于顶部；目标风险 ID 固定，提交读取最新共享状态，失败保留输入和选择。

`domain/risk-decisions.ts` 提供预览和服务共用的策略判定；`domain/assessment.ts` 统一计算工具可迁范围，`policies.ts` 计算阶段条件。风险是否已选策略不能代替迁移资格。`RiskOverview` 用项目完整风险计算，筛选和多选不改变图表口径；具体门禁与统计口径只在业务说明维护。

### 规划与导出

`domain/planning.ts` 定义资产、约束、依赖、容量、批次、预览和纯计算。`mock/planning-data.ts` 从评估范围初始化，`mock/planning.ts` 校验、生成和应用修改，`mock/planning-files.ts` 从同一快照导出模板、计划和 RunBook。

对话 `PlanningIntake` 提供导表、模板、基础约束与生成入口，草稿按项目保存在 store。生成后 `PlanningSummary/PlanningTimeline` 只读展示指标、核对事项及甘特图，不再跳转批次资产页；完整资产和资源字段通过现有导出查看。调整通过对话文字或附件提出，由 `PlanningPreview` 在输入框确认。`planning.generate` 是中性生成能力，Mock 内部生成示例计划；`planning.sampleInputs` 只用于显式演示资料入口。

`assessment-files.ts` 与动态加载的 `assessment-presentation.ts` 从同一评估快照生成 Excel/PPTX。页面只传资源 ID 给下载服务，不生成业务文件；格式、更新语义和资源 ID 见接口说明。

### 实施与验证

`ProjectSnapshot.execution` 是唯一执行事实源，旧兼容读模型只由 `mock/execution-state.ts` 投影。`mock/execution-engine.ts` 每项目一个模拟循环，`execution-issues.ts` 处理故障和诊断，`validation.ts` 处理验收、反馈及报告；切换查看位置不复制任务状态。

`ConnectionForm` 在对话内配置连接，非敏感草稿按项目保存，密码只存在表单。`ExecutionWorkspace/ExecutionDashboard` 组成实施侧面板，从现有任务、时间与趋势生成只读统计；批次和分页按项目保留，指定任务定位后关联对话。`ExecutionIssueEditor/ExecutionPreview` 复用于输入框确认，`ValidationWorkspace` 保留既有技术核对、业务验证、反馈、附件和报告能力。

服务提供可选 `execution.recommendedBatchId`，UI 先使用有效用户选择，再使用有效推荐值，最后回退首批；不根据样例标记选择固定数组位置。状态和视图通过增量 patch 更新，延迟操作回执不覆盖用户后来选择的批次/页码。

### 账户与演示边界

`SettingsDrawer/NexentSettings` 接收脱敏 AccountState 与保存回调。保存消费服务返回状态，不能自行推断认证成功；秘密不放公共 store，成功清空、失败保留。实际认证协议仍留在 HTTP 适配器，当前模板未实现。

`Catalog.capabilities?.demoTools === true` 才显示样例按钮、故障注入和 Mock 说明。UI 只读取目录能力，不读取服务模式、导入 fixture 或生成样例。`ProjectSnapshot.demoMode` 独立表示 Mock 宽松演示推进，不能兼作认证或后端能力开关。Mock 的冻结样例、缺失资料补齐、场景执行均由服务管理。

## 常见修改入口

| 修改                       | 入口                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------- |
| 后端 DTO、认证、错误与事件 | services/contracts.ts、services/http；先读 integration.md                             |
| 配置和服务装配             | app/config.ts、services/index.ts                                                      |
| 公共状态、退出隔离         | stores/workspaceStore.ts、stores/*State.ts、app/workspaceSession.ts                   |
| 偏好持久化及首屏主题       | stores/preferencesStore.ts、shared/preference-config.ts、shared/preferences.ts        |
| 导航、面板和操作绑定       | workspace/Sidebar、WorkspaceSidePanel、Workspace、useWorkspaceActions                 |
| 回答、输入和确认           | conversations/ConversationAnswer、BusinessResults、Composer、ConversationConfirmation |
| 风险与范围                 | risks/RiskWorkspace、CategoryRiskTable、RiskStrategyEditor；domain/assessment         |
| 规划和文件                 | domain/planning、mock/planning*、planning/PlanningIntake、PlanningSummary             |
| 实施和验收                 | domain/execution、mock/execution*、mock/validation、migration、validation             |
| 主题、字号、语义色、文案   | styles/tokens.css、styles/index.css、shared/i18n                                      |

CSS Modules 就近维护，不修改全局字号来修补单个面板。运行命令见 [README](../README.md)，验证和协作约定见 [AGENTS.md](../AGENTS.md)。Mock 功能回归不代表真实迁移服务已验证。
