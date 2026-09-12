# MigrationDirector +

迁移交付工作台的前端交互原型，用于设计和体验调研评估、规划设计、迁移实施、结果验证四个阶段。

## 项目如何运行

这是 Web 项目，源码需要通过开发服务编译，不能直接双击 `app/page.tsx` 打开。

```text
npm run dev
    ↓
Vinext / Vite 启动本地开发服务
    ↓
编译 React、TypeScript 和 CSS
    ↓
浏览器访问 http://localhost:3000/
```

技术栈为 React 19、TypeScript、Tailwind CSS 4。目录采用 Next.js App Router 的结构，但实际启动命令使用 **Vinext**，不是 `next dev`。

修改源码后，开发服务通常会自动更新页面。终端里的服务需要保持运行；退出服务后，本地地址就无法访问。

## 本地启动

环境要求：Node.js **22.13.0 或以上**，以及 npm。首次安装依赖需要联网。

首次获取代码并启动（macOS / Linux）：

```bash
git clone https://github.com/lyhlyhlyh233/migrationagentdemo.git
cd migrationagentdemo
npm ci
SITES_LOCAL_NODE_PREVIEW=1 npm run dev -- --host 127.0.0.1 --port 3000
```

已有源码时，直接进入项目目录，从 `npm ci` 开始执行即可。私有仓库克隆需要对应 GitHub 访问权限。启动后打开 [本地页面](http://localhost:3000/)。

- 依赖已经安装且锁文件没有变化时，可以跳过 `npm ci`。
- `SITES_LOCAL_NODE_PREVIEW=1` 会让配置跳过 Cloudflare 插件，使用本地 Node 模式预览；推荐本地开发时带上它。
- 本地原型无需配置模型 API Key 或数据库账号。
- 停止服务：在启动服务的终端按 `Ctrl + C`。
- 3000 端口已占用时，先查看已有页面，或将启动命令中的端口改为 `3001`，再访问对应地址。

Windows PowerShell 的启动写法：

```powershell
$env:SITES_LOCAL_NODE_PREVIEW = "1"
npm run dev -- --host 127.0.0.1 --port 3000
```

同样需要先进入项目目录并安装依赖。

## 构建与检查

以下命令均在项目目录执行：

```bash
# TypeScript 类型检查
npx tsc --noEmit

# 代码规范检查
npm run lint

# 构建本地 Node 模式产物
SITES_LOCAL_NODE_PREVIEW=1 npm run build

# 启动构建后的服务（需先构建；不要与开发服务占用同一端口）
SITES_LOCAL_NODE_PREVIEW=1 npm run start
```

开发阶段使用 `npm run dev` 即可，不需要每次都构建。`npm run start` 本身不负责构建，也不提供开发时的热更新。

## 主要文件

| 路径 | 用途 |
| --- | --- |
| `app/page.tsx` | 主页面、项目切换、阶段流程、聊天记录，以及任务和风险等管理界面；目前大部分业务交互集中在这里 |
| `app/workspace-ui.tsx` | 图标、输入框上方快捷菜单、右侧执行详情等公共组件 |
| `app/globals.css` | 页面布局、字体、颜色、组件样式与响应式适配 |
| `app/layout.tsx` | 全局页面框架、网页标题和元信息 |
| `app/mock-agent.ts`、`app/types.ts` | 保留的模拟服务及类型文件；当前主页面未接入该模拟服务 |
| `public/` | 图标等静态资源 |
| `package.json` | 依赖和启动、构建、检查命令 |
| `package-lock.json` | 锁定依赖版本，供 `npm ci` 使用 |
| `vite.config.ts` | Vinext、Vite、样式处理与本地预览配置 |
| `.openai/hosting.json` | 现有 Vite 配置依赖的托管配置文件；复制项目时需要保留这个隐藏目录 |
| `PRODUCT.md` | 当前产品定位及交互约定 |
| `DESIGN.md` | 当前界面设计规范 |
| `业务逻辑说明.md` | 业务流程说明，部分界面描述可能早于最新设计，当前交互以源码为准 |

`node_modules/` 和构建输出属于生成文件，不是主要开发源码。分享项目时通常不需要携带依赖目录，接收方可执行 `npm ci` 安装。

## 当前原型的能力边界

- 项目、会话、风险和任务状态保存在当前页面的 React 内存状态中；项目之间切换会保留状态，刷新或重新打开页面会重置。
- AI 回复通过前端规则和预设文本生成，没有调用真实大模型。
- 评估、批次规划、MD 连接检查、执行进度及配置验证由示例数据和定时器模拟，不会执行真实迁移。
- 选择资料文件时主要记录文件名，没有上传服务器，也没有实现真实的 Excel 内容解析。
- 报告和表格下载由前端依据当前示例状态生成。
- 用户区域目前是界面占位，没有实现登录认证。
- 未接入真实业务后端、数据库或持久化存储；配置中的托管能力不等于业务已经接入这些服务。

后续正式实现时，需要将前端模拟逻辑替换为模型服务、迁移执行接口、文件解析、任务状态订阅及数据存储。
