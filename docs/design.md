# 项目架构与接口适配

本项目是独立静态前端，采用 React Context、三个职责明确的 reducer 和一个服务契约。没有新增状态库、路由库、依赖注入框架或通用流程引擎。视觉规则见 [DESIGN.md](../DESIGN.md)，业务规则见 [业务逻辑说明.md](../业务逻辑说明.md)。

## 目录与依赖

```text
src/
  app/           浏览器入口、服务装配、Provider、快照和导航状态
  domain/        项目/会话/任务模型、阶段条件和重复执行判断
  services/      服务契约、错误、Mock 和 HTTP 适配模板
  features/
    workspace/   工作区布局、导航、进度、右侧详情和操作绑定
    projects/    项目创建表单
    conversations/ 对话正文、结果块、快捷操作、输入框与草稿
    research/    对话内评估输入和方案选择
    planning/    范围与规划信息表单
    migration/   MD 检查、创建/同步/割接任务视图
    validation/  配置对比和人工验收
    tasks/       任务管理和批次计划
    risks/       分类策略、风险抽屉和管理列表
    deliverables/ 交付文件列表
    logs/        项目操作记录
    settings/    外观、背景、语言及 Nexent 配置
  shared/        Select、按钮、字段、状态、结果框架、图标、国际化
  styles/        基础规则、主题变量、全局背景和语义颜色
```

`domain` 不依赖 React、HTTP 或 Mock。界面使用领域模型和服务契约，通过 Provider 与 `useWorkspaceActions` 绑定业务操作；展示组件接收快照与回调，不启动业务计时器、生成任务或直接调用 HTTP。文件保存到本地的浏览器动作在 `shared/files.ts`。

表单草稿、列表筛选和确认展开等局部状态保留在组件中。先沿现有功能模块改动，不为每个字段或单个按钮新增抽象。

## 数据与状态流

```text
组件输入 / 点击
      ↓
useWorkspaceActions：捕获项目、会话、阶段及操作身份
      ↓
MigrationService：校验条件 → 执行命令
      ↓
ServiceEvent：版本化项目快照 / 通知 / 错误
      ↓
dataReducer → 当前工作区和共享结果状态
```

- `app/state.ts` 的 `dataReducer` 保存服务快照，忽略旧版本事件；`uiReducer` 保存选中项目、当前会话、最近阶段会话、管理页和交接预览。
- `features/conversations/state.ts` 的 `conversationReducer` 按项目、会话保存草稿、Agent、模型、展开表单和重试 requestId。
- 项目状态、消息、等待中的回复、任务进度和审批记录由服务持有，界面不维护第二套执行逻辑。
- 仅挂载选中的工作区。项目切换后数据仍在 Provider/服务内存中，不再通过隐藏所有项目页面保存状态。
- 消息和命令携带 `OperationContext`。异步闭包捕获发起上下文；后台结果不会使用完成时的当前项目或会话。
- `requestId` 用于回复重试去重；业务操作按项目内 operation key 防重复。真实适配器也需要服务端幂等保证。
- 手动确认阶段交接后进入新主会话。如果用户在等待期间已切到其他会话，过期的导航完成事件不会覆盖当前选择。
- 退出调用 `logout/dispose`，撤销 Mock 计时器、清空项目与文件、清除订阅；React 状态随后卸载。主题偏好独立保存在 localStorage。

## 服务契约

阅读 `src/services/contracts.ts`，它定义前端需要的能力，不是已约定的后端路由。

| 能力               | 契约入口                                                       |
| ------------------ | -------------------------------------------------------------- |
| 项目、会话         | list/get/create project，create/rename conversation            |
| 聊天、模型、Agent  | catalog、sendMessage、subscribe                                |
| 文件               | upload(File)、download → Blob/文件名/媒体类型                  |
| 评估、规划、交接   | execute 的 assessment/planning/stage 命令                      |
| MD、创建/同步/割接 | md.check、execution.confirm、creation.update、cutover.complete |
| 任务、风险、验证   | tasks.action、risk.decide/recommend/close、validation.confirm  |
| 交付件、日志       | 项目快照内 artifacts/messages；文件内容经 download 获取        |
| 账户与 Nexent      | getAccount、configureAccount、logout                           |

`services/mock/` 按评估、规划、执行、对话和文件拆分。`runtime.ts` 负责内存状态、发布快照、可取消等待和执行锁；通用资产/规划风险在 `fixtures.ts`，评估规则示例与报告解读在 `assessment-knowledge.ts`，策略命令在 `risk-decisions.ts`。这些均不进入展示组件。

当前 `ServiceEvent` 使用完整项目快照，规模适合原型。未来可由适配器聚合聊天增量与任务进度，再发布版本化快照；无需让组件识别 SSE、WebSocket 或轮询格式。本轮没有流式字符动画或网络传输实现。

## 风险界面与定位

`RiskDrawer` 与 `RiskPanel` 分别负责抽屉和独立页外壳，复用 `RiskWorkspace` 的筛选及局部编辑状态。`CategoryRiskTable` 按规则与影响呈现分组，`RiskVmDetails` 复用虚拟机明细与核验证据，`RiskStrategyEditor` 负责策略表单。`presentation.ts` 只计算展示分组，不执行业务命令。

`ProjectUi.riskLocation` 保存类别／虚拟机模式及定位键。抽屉跳转把虚拟机定位交给管理页面，仍与当前项目隔离；不引入 URL 路由或刷新持久化。相同规则、阶段、类别、影响才能合并；缺失规则按记录独立展示，虚拟机优先以 ID 区分。

`risk.decide` 和 `risk.recommend` 支持可选的 `onlyUndecided`。类别及规则批量操作设置为 true，Mock 在执行时基于最新状态排除已有选择或已核验项；全部已有选择时明确失败，不假装保存成功。单台页面主动修改保持原有覆盖语义。未来 HTTP 适配器必须保留此语义，避免客户端旧快照覆盖新策略。

## 评估范围与可选风险策略

`domain/assessment.ts` 集中计算工具可迁范围与风险处置状态。风险等级、阻塞性质和用户策略是不同字段；不以“是否已读”推断可迁。未确认风险不阻塞阶段交接，受阻/未验证/显式不迁对象按虚拟机排除，约束项继续携带到规划。`policies.ts` 仅检查阶段必要工作与顺序；`planning.ts` 和 `execution.ts` 使用同一范围计算。

`assessment.choosePlan` 保存总体偏好，`risk.decide` 批量保存同一策略，`risk.recommend` 为每项采用各自建议，`risk.close` 记录人工整改验证。策略保存不标记整改完成。原始发现不改变，历史结论保留快照，后续处置记录可更新。MD 准备开始后不再修改策略，避免已创建任务被静默改写；新增验证不会自动追加已生成批次。

`stage.review` 在发起会话返回交接说明及 approval 引用；统一深色入口位于输入框上方右侧。点击确认仍调用 `stage.confirm`，而不是直接通过前端导航开启阶段。

评估资料中的报告属于模板，包含占位符和互相不一致的示例数值；只借鉴报告维度与规则，不将其当成当前项目真实输出。仅迁移调研表原始模板纳入 `src/services/mock/templates/`，其余原始 Excel/PPT 文件未纳入前端仓库。

评估资料中“下载模板”调用现有 `download(projectId, "research-template")`，Mock 返回随应用打包的真实 XLSX，不生成交付件或修改上传状态。模板含 7 个工作表和原有填写示例，用户需按项目实际情况替换后上传。模板通过 Vite 资源导入适配部署路径；下载支持取消、退出清理与失败重试。接入后端时在同一下载契约下适配此资源，无需修改表单。

## 接真实后端的最短路径

1. 与后端确认实际 API、DTO、认证和事件协议，再修改 `services/http/index.ts` 的对应方法。
2. 将真实 DTO 映射为 `domain/models.ts`。`mapping.example.ts` 只演示运行时校验和转换方式，其中字段是示意，不是服务端约定。
3. JSON 请求可复用 `http/client.ts`，它支持 AbortSignal、HTTP/网络错误。上传使用 File/FormData，下载处理 Blob 与文件元信息，按真实接口实现。
4. 从 `import.meta.env.VITE_API_BASE_URL` 读取地址。不要把认证信息塞进 VITE 环境变量，也不要硬编码未知 URL。
5. 接收事件后调用同一 `subscribe` 订阅者；按资源 ID 合并数据，保留项目、会话和操作归属。`dispose` 必须取消请求和关闭订阅连接。
6. 设置 `VITE_SERVICE_MODE=http` 并测试。未实现的方法继续明确抛出 NOT_CONFIGURED，绝不退回模拟成功。

契约允许请求传入 AbortSignal。切换工作区不会主动取消业务任务；取消用于调用方明确撤销或退出清理。失败保留用户输入，回复沿原 requestId 重试；业务命令失败释放执行锁，以便再次提交。

## 结构化回答

`ChatMessage` 可包含纯文本、可折叠的 `reply.summary` 和 `results`。服务返回领域数据，不返回 JSX、HTML 或组件名称。

| result.kind         | 内容与行为                                                         |
| ------------------- | ------------------------------------------------------------------ |
| assessment-input    | 输入用途及上传快照；最新一条展示可操作的资料输入，其余收为历史记录 |
| assessment-decision | 兼容标记；评估快捷操作统一渲染在整组结果底部                                     |
| summary             | 当次结论、指标快照；提供风险/计划入口                              |
| tasks               | 关联任务 ID；从最新项目快照读取状态和进度                          |
| artifacts           | 关联交付件 ID；文件通过服务下载                                    |
| approval            | 关联确认项 ID；查看条件后确认，依据当前共享状态禁用重复提交        |

`BusinessResults.tsx` 选择呈现组件，列表默认三项，用户可展开。普通文字回复不强加结果块。新增结果类型只需扩展领域联合类型、服务返回内容及此呈现分支，不引入组件注册系统。

历史结论和数值不会随项目状态变化而重算；资源与确认按钮以 ID 查询当前状态。交付报告和计划在本轮一次生成，不覆盖历史内容。未来允许修订文件时，适配器应为版本提供新资源 ID。

## 界面与样式修改位置

| 修改                     | 文件入口                                                           |
| ------------------------ | ------------------------------------------------------------------ |
| 菜单顺序、折叠、会话列表 | workspace/Sidebar、StageNavigation                                 |
| 四阶条件/进度            | domain/policies、workspace/presentation、ProgressRail              |
| 聊天排版和业务结果       | conversations/Conversation、ConversationAnswer、BusinessResults    |
| Agent/模型目录           | services 的 catalog；选择框只呈现返回选项                          |
| 阶段表单                 | research、planning、migration、validation 对应模块                 |
| 表格和风险策略           | tasks/TaskPanel、risks/RiskWorkspace / CategoryRiskTable / RiskVmDetails / RiskStrategyEditor |
| 主题/字号/语义颜色       | styles/tokens.css 和 styles/index.css                              |
| 界面翻译                 | shared/i18n/en.json、status-labels、stages                         |

CSS Modules 放在功能附近。工作区、对话、输入区、设置、项目创建和管理视图各自隔离；保留下来的表格/布局类名通过 Module 根节点限定作用域，便于继续修改既有复杂表单。共用管理表格规则集中在 `ManagementView.module.css`，避免为每个表格复制一套样式。全局仅保留基础控制、主题和背景等跨页面规则。

## 当前边界

Mock 文件上传只验证文件名后缀并接收 File，不解析真实 Excel；资产数量和任务来自样例。规划调整记录需求但不重算排期；单任务同步/暂停/定时仅模拟状态。Nexent 保存仅保留本次配置并标记未验证，模型名称仅为占位。不要把这些模拟能力描述为真实迁移成功。

运行与静态部署见 [README](../README.md)。检查命令和协作约定见 [AGENTS.md](../AGENTS.md)。

## 验证范围

针对性服务测试覆盖自动首轮对话、可跳过风险的交接、受阻对象过滤、策略与整改分离、项目/会话隔离、失败重试及退出清理。风险分组测试检查同规则同影响合并、缺失规则不合并及虚拟机 ID 去重。`npm run check` 与 `npm run build` 为代码验收入口；浏览器检查覆盖分类抽屉、虚拟机定位、四主题、中英文、窄屏和 2K。不执行完整迁移流程回归，不验证真实后端。
