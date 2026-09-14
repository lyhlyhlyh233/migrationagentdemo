# AI 接手入口

这是 MigrationDirector Plus 的独立前端。先理解现有结构，再改当前需求；不要继续扩展框架或抽象层。

## 阅读顺序

1. [AGENTS.md](AGENTS.md)：协作约定、依赖边界、检查和自动推送。
2. [README.md](README.md)：运行、配置、内网安装和部署。
3. [docs/design.md](docs/design.md)：源码职责、状态归属与接口适配。
4. [业务逻辑说明.md](业务逻辑说明.md)：四阶条件和人工确认规则。
5. 涉及界面时阅读 [PRODUCT.md](PRODUCT.md)、[DESIGN.md](DESIGN.md)，按 Impeccable 工作流执行。

## 最短代码阅读路线

`src/app/main.tsx` → `App.tsx` / `WorkspaceProvider.tsx` → `features/workspace/Workspace.tsx` → `services/contracts.ts` → `domain/models.ts` / `policies.ts`。

业务执行位于 `services/mock/`，展示和局部草稿位于 `features/`。HTTP 模板故意未实现后端地址，切换 http 模式应显示未接入，不能伪装成成功。

## 修改时必须保留

- 项目与会话隔离；切换页面不丢草稿、不串异步回复。
- 阶段前置条件、人工交接和共享操作防重复；后台完成不强制跳转。
- 主会话带阶段引导，子会话按需展开表单。
- 历史统计快照与实时任务状态分开；旧确认项不能重复执行。
- 模型和 Agent 由服务目录提供，输入框左 Agent、右模型。
- 白/黑/绿/红主题、全局背景、中英文和手机导航。

## 模拟范围

没有真实迁移、Excel 解析、模型服务或 Nexent 登录。阶段任务通过可取消计时器模拟，回复为编写好的文案。业务数据刷新后重置，偏好持久化。不要加入密钥、虚构端点或为了演示而绕过门禁。

完成后运行所需检查，更新受影响文档，按用户授权自动提交并普通推送 GitHub。报告实际验证范围，不宣称完成真实业务回归。
