# MigrationDirector Plus

用于迁移项目交付的独立前端，支持调研评估、规划设计、迁移实施、结果验证四个阶段。技术栈为 **Vite + React 19 + TypeScript**，构建后是可部署到内网的静态文件。

当前默认使用完整的前端 Mock。没有真实模型调用、迁移执行或账户认证；刷新会重置业务数据，外观、背景和语言偏好保留。

## 本地运行

需要 Node.js 22.13 或以上版本，以及 npm。

```bash
npm ci
npm run dev
```

访问终端输出的地址，默认是 `http://127.0.0.1:3000/`。修改源码自动更新，停止服务按 `Ctrl+C`。端口冲突时可运行 `npm run dev -- --port 3001`。

源码入口是 `src/app/main.tsx`，不能直接双击 TSX 文件运行。无需数据库、Cloudflare、Next 服务端或模型凭据。

## 配置

复制 `.env.example` 为 `.env.local`，按需修改：

| 配置                | 默认值 | 作用                                                   |
| ------------------- | ------ | ------------------------------------------------------ |
| `VITE_SERVICE_MODE` | `mock` | `mock` 为模拟服务；`http` 为待适配模板，明确提示未接入 |
| `VITE_API_BASE_URL` | 空     | 由应用传给 HTTP 适配模板的基础地址，当前未接入接口，不发起后端请求 |
| `VITE_DEPLOY_BASE`  | `/`    | 静态部署路径，如 `/migration/`                         |

这些变量在构建时写入前端，**不可放密码、API Key 等秘密**。修改后重新启动开发服务或重新构建。服务配置统一在 `src/app/config.ts` 读取，具体实现仅在 `src/services/index.ts` 装配。Nexent 配置通过界面输入，本轮仅在内存保存并标记为未验证。

## 检查与构建

```bash
npm run typecheck
npm run lint
npm test
npm run check       # 上述三项一起运行
npm run build      # 类型检查 + 生产构建
npm run preview    # 本地检查 dist，默认 4173 端口
```

单元测试针对阶段门禁、人工交接、重复执行、异步归属、请求取消与重试、数据隔离和退出清理，不代表真实迁移流程已验证。

## 内网安装与部署

**仅部署运行**：在可构建环境执行 `npm ci`、`npm run build`，将整个 `dist/` 复制到内网 Web 服务器。服务器只需提供静态文件，不需要 Node.js。背景图、图标、字体栈和脚本均无需外网 CDN。

**在内网继续开发**：带入源码和 `package-lock.json`，从内网 npm 镜像执行 `npm ci`。完全离线时，应提前在相同操作系统、CPU 架构与 Node 版本的环境准备 npm 缓存及依赖，再验证离线安装；不要跨平台直接复制 `node_modules`，Vite 构建工具包含平台相关依赖。

子目录部署示例：在 `.env.local` 中设置 `VITE_DEPLOY_BASE=/migration/`，重新构建，将 `dist/` 内容放到站点的 `migration/` 目录，访问 `/migration/`。Vite 会处理 HTML、CSS 和脚本资源前缀，背景预览使用同一基础路径。当前工作区切换采用前端状态，不要求路径路由回退配置。生产站点建议使用 HTTPS，以支持浏览器剪贴板等能力。

## 修改与接手入口

- [项目架构](docs/design.md)：目录职责、依赖边界、状态流和常见修改位置。
- [接口适配说明](docs/integration.md)：能力契约、DTO/事件映射、ID、文件、取消与接入验收。
- [AI 接手入口](agent.md)：阅读顺序和修改边界。
- [视觉规范](DESIGN.md)：主题、文字、结果块和响应式规则。
- [产品说明](PRODUCT.md)：面向用户的功能范围。
- [业务逻辑](业务逻辑说明.md)：四阶前置条件、共享状态与模拟边界。
- [协作约定](AGENTS.md)：开发约束、检查与自动提交推送。

调研评估支持自动首轮对话、报告解读和按类别/虚拟机选择风险策略。风险可暂不处理直接交接，受阻对象自动排除；目前依旧使用模拟数据，原始调研表不会被真实解析。详细规则见 [业务逻辑说明](业务逻辑说明.md)。

## 版本基线

`V1_0914` 标记本次架构与文档整理后的源码，作为内网适配基线；它仍是 Mock 版本，不代表真实后端已完成。获取该版本后可建立自己的适配分支：

```bash
git fetch origin --tags
git switch -c internal-adaptation V1_0914
npm ci
```

仅部署时也可从此标签构建 `dist/`。标签指向源码提交，依赖与构建产物不纳入 Git。
