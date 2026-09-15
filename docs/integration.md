# 接口适配说明

供内网后端适配使用。当前唯一可运行实现是 Mock，`http` 是明确失败的模板。本文件说明前端契约，不约定后端 URL、DTO 字段或认证协议。

## 从哪里开始

1. 阅读 `src/services/contracts.ts` 和 `src/domain/models.ts`，与后端确认真实接口、返回数据、认证及任务事件协议。
2. 在 `services/http/index.ts` 实现 `MigrationService` 对应方法。它接收工厂传入的 `baseUrl`；不用让组件读取地址或知道服务模式。
3. 在适配器内将实际 DTO 映射为领域数据。`mapping.example.ts` 仅演示运行时校验，示例字段不是后端规范；不要用类型断言代替校验。
4. JSON 请求可使用 `http/client.ts`。上传、下载、空响应和事件流按真实协议实现，不强行套进 JSON 工具。
5. 设置 `VITE_SERVICE_MODE=http`、`VITE_API_BASE_URL`，运行契约与交互检查。仅填写基础地址不会开启后端；未实现能力继续抛出 `NOT_CONFIGURED`，不能回退到 Mock。

`VITE_DEPLOY_BASE` 控制静态资源路径，与 API 地址分开。所有 VITE 变量均公开，不能放密钥。配置读取位于 `app/config.ts`，无需在每个服务中重复读取环境。基础工厂只返回 `MigrationService`，UI 不可访问 Mock 的 runtime。

## 能力与返回内容

| 能力 | 契约入口 | 适配重点 |
| --- | --- | --- |
| 项目 | listProjects、createProject、getProject | 返回列表/完整项目快照，保留项目隔离 |
| 会话 | createConversation、renameConversation | 独立 ID、所属阶段、主/子/临时类型 |
| Agent、模型 | catalog | 目录 ID、默认值及可选 stageAgents 映射 |
| 回复 | sendMessage、stopReply | requestId 重试去重；文本、思考摘要、领域结果、耗时；按 runId 停止当前思考 |
| 评估/规划/交接 | execute 的 assessment、planning、stage 命令 | 阶段条件、人工确认、不可重复启动 |
| MD/实施/验收 | md.check、execution.confirm、creation.update、cutover.complete、validation.confirm | 共享任务与审批状态，按资源 ID 操作 |
| 风险/任务 | risk.decide、risk.recommend、risk.ignoreOrExclude、risk.close、tasks.action | 最新状态校验、批量原子性与阶段锁定 |
| 文件 | upload(File)、download | File 输入，Blob、filename、mediaType 输出 |
| 账户 | getAccount、configureAccount、logout | 区分配置与真实验证，不回传明文凭据 |
| 实时状态 | subscribe、dispose | 统一事件、取消订阅、请求和连接清理 |

契约是前端能力边界，不需要拆成等量后端接口。`assessment.choosePlan` 是保留的兼容命令，当前页面已没有总体方案选择入口；`assessment-decision` 也是历史结果标记，不需要为其新增后端能力。

## ID、快照与事件约定

- 项目、会话、任务及文件 ID 来自服务，前端不能从阶段名称推导 ID。领域类型中的风险/消息 ID 当前为 number；后端若使用字符串 ID，应协调修改类型与使用点，不能通过有碰撞的数字转换适配。
- `EMPTY_WORKSPACE_ID`（值为 `lobby`）是无项目工作空间的保留标识，不是实际迁移项目。`getProject` 需返回其 `info: null` 快照，`listProjects` 不列出它；可以在适配器内维护此工作空间或映射后端会话空间，无需创建名为 lobby 的业务项目。真实项目不能占用此标识。
- `createProject` 提供评估主会话，阶段确认后由服务创建下一阶段主会话。前端按 `kind/stageId` 查找；初次自动问答也由服务产出，组件不补造消息。
- `catalog.defaultAgent/defaultModel` 以及 `stageAgents` 中的值必须属于相应目录；阶段代码与 Agent ID 独立。未提供阶段映射时使用 defaultAgent。
- `ProjectSnapshot` 是前端视图快照，适配器可聚合多个 API 的数据；组件不得修改。`revision` 在同一项目和服务生命周期中递增，较旧快照会被 reducer 忽略；相同 revision 应代表同一数据。
- `subscribe` 同步返回取消订阅函数。当前事件为完整快照、通知或错误；SSE/WebSocket/轮询在适配器内转换和合并，不进入组件。
- 创建、重命名、命令与上传成功返回前，需发布对应项目的最新快照。界面依赖事件更新共享数据；只返回一个 ID 而不发快照会让新项目或会话无法显示。订阅在初始读取前建立，读取和事件可能交错，依靠 revision 处理旧数据。
- `sendMessage` 完整回复后兑现 Promise；失败通过拒绝让界面保留原文和 requestId。长任务可持续发布进度，`execute/upload` 完成当前操作后兑现；后端若只返回 job ID，适配器需跟踪结果，不能把“已提交”伪装成“已完成”。
- `OperationContext` 的项目、会话、阶段和 operationId 在发起时固定。事件中的消息也要保留这些关联，不能取任务完成时当前打开的会话。通知是界面提示，不能替代操作 Promise 的失败结果。

原型继续使用完整快照，不引入事件总线、增量状态框架或组件端连接管理。聊天统计保存当次快照；任务、文件、approval 引用从最新项目数据读取。

## 幂等、风险和人工确认

`requestId` 用于同一条聊天的重试，重复请求不能重复追加用户消息。operationId 标识一次命令，另需按项目/操作或任务资源校验共享执行状态；operationId 不相同也不能重复启动同一任务。当前 Mock 的 operation key 与执行锁位于 `runtime.ts`，真实环境应由后端保证并发与幂等。

`stage.review` 返回交接说明和 approval 引用；只有 `stage.confirm` 才开启下一阶段。旧消息中的确认入口根据最新 approval 状态禁用。不能用“风险都已处理”作为交接条件，也不能跳过既有阶段必要工作。

风险提交基于最新数据验证项目、阶段锁定、资源与策略。默认批量界面传 `onlyUndecided: true`，服务执行时再次过滤，保护其他会话的新选择；省略或传 false 表示允许覆盖，不能擅自更改语义。一次批量操作先整体校验、再写入，失败不留部分结果；覆盖会重置相关验证状态。

`domain/risk-decisions.ts` 为预览与 Mock 共用判定：忽略可接受约束项，其余不迁；推荐逐项采用各自建议。`domain/assessment.ts` 从全部项目风险计算虚拟机资格；选择整改不等于完成验证，受阻/未验证/本次不迁对象仍排除。详细条件只在 [业务逻辑说明](../业务逻辑说明.md) 维护。

## 文件、日志与账户

`upload` 接收 File 和用途 `rvtools/presales/scope/planning`。真实适配器按已约定的上传和解析接口处理；组件不读 Excel。`download` 通过服务返回 Blob 与元信息，页面仅调用 `shared/files.ts` 触发保存。

除快照内的 artifact ID，当前下载契约还有两个保留资源格式：

| 资源标识 | 含义 |
| --- | --- |
| research-template | 原始迁移调研 XLSX 模板，Mock 从随应用打包的资源读取 |
| task-log:后接逗号分隔的任务ID | 已选任务的日志下载，Mock 从当前项目任务生成文本 |

这是客户端资源约定，不是 URL。适配器将它们映射为真实资源；如真实任务 ID 允许逗号，应改为类型化下载参数并同步唯一调用处，不直接拼出后端 URL。

当前评估报告和批次计划生成后保留；范围清单、规划信息模板、风险处置方案在处置变化后使用原 ID 更新为当前内容。聊天中的历史统计不随之改变，下载引用会取得该资源的当前内容。需要历史文件版本时再增加版本资源 ID，本轮没有文件版本库。

项目操作日志由消息中的 operation 标记及来源会话生成，没有独立审计后端。`getAccount` 只返回 configured、verified 和方式；Mock 只保存此状态，设置表单本次内存保存用户输入，退出清除，不落 localStorage。真实凭据的传输、保管、验证和登录态按内网平台规范在适配器/后端实现，配置成功不能等同于 verified。

## 取消、错误与退出

`stopReply(context, runId)` 停止指定会话中匹配的 pending 回复，包含自动开场和评估/规划/MD 检查等待；已结束或不匹配的 runId 无副作用。每次运行（包括重试）使用新 runId，与消息重试的 requestId 分开。停止完成后发布清除 pending 的快照及一条“已停止回复”，被停止的原请求拒绝为 STOPPED；UI 不将主动停止显示为失败或恢复成待重试输入。其他错误仍保留输入。后台迁移任务不属于 pending 回复，不受停止按钮影响。真实适配器须按协议停止生成并忽略后续迟到结果，不能只隐藏加载状态。

所有请求接受可选 `RequestOptions.signal`。初始化重试/卸载会取消旧读取，切换项目和会话不取消业务任务。JSON 工具区分 NETWORK、HTTP、ABORTED，连同读取响应体时的取消；领域校验使用 PRECONDITION/VALIDATION，重复执行使用 CONFLICT，缺失资源使用 NOT_FOUND，未接入使用 NOT_CONFIGURED。

组件在 Promise 失败时保留输入、选择和位置。服务应释放可重试的执行锁并发布一致状态；真实任务是否已产生副作用需通过后端状态判断，不能将断网或取消请求等同于服务端回滚。

`logout` 成功后清除当前会话；`dispose` 必须可重复调用，停止本次请求、业务等待、订阅连接，清除本地引用，且不再发布事件。仅 AbortSignal 不能代替关闭 WebSocket/EventSource 等连接。外观偏好属于浏览器本地状态，退出后保留。

## 接入验收与已知边界

运行 `npm run check`、`npm run build`。已有测试覆盖会话实际 ID、配置注入、未配置失败、取消与退出、交接、风险范围、批量并发与重试。适配真实 HTTP 时，用实际 DTO/协议补充映射、失败、取消和事件归属测试；现有 Mock 测试不证明真实后端可用。

本轮没有增加网络接口。Mock 上传不解析内容，资产和执行结果为样例，回复是预编文案，Nexent 未验证，业务数据刷新后重置。`scopeRows` 仍是固定列数组，部分资产关联使用虚拟机名称，日志时间和部分提示为展示文字；拿到真实资产和消息结构后再有针对性调整，不在本轮预造新的数据模型。
