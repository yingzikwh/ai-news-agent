# AI News Agent · 全自动 AI 资讯抓取客户端

基于 **CodeBuddy Agent SDK** 构建的客户端 Agent 应用：自动定时抓取多个 AI 信息源的最新新闻与资讯，
支持实时展示、未读提醒、分类筛选、关键词搜索、收藏与历史记录。使用 **React + Express + Electron**
实现，Web 版本可独立运行于浏览器，Electron 版本可打包为桌面应用，二者共享同一套 UI 与交互。

---

## ✨ 功能特性

- **Agent 自动抓取**：基于 CodeBuddy Agent SDK，Agent 使用内置网络工具访问配置的信息源并返回结构化资讯；
  未配置 Key 时自动回退到**直连 RSS/Atom 抓取**，保证开箱即用。
- **定时调度**：支持配置抓取间隔（5 分钟 ~ 6 小时）与抓取模式（混合 / 仅 Agent / 仅直连），可随时手动「立即抓取」。
- **实时推送**：通过 SSE 将新抓取到的资讯实时推送到前端，新消息自动提醒（Toast + 未读标记/小红点）。
- **分类筛选**：模型发布 / 行业动态 / 学术论文 / 工具更新 / 政策监管 / 其他，侧边栏一键切换。
- **关键词搜索**：跨标题、摘要、来源、标签全文检索。
- **收藏与历史**：支持单条收藏、标记已读、全部已读；历史记录持久化（JSON 存储，可随时回溯）。
- **数据源可配置**：内置 9 个高质量 RSS 源，支持增删改与启停、指定分类。
- **离线缓存**：Service Worker 缓存应用外壳 + localStorage 缓存已抓取资讯，弱网/离线仍可浏览历史。
- **明暗主题**：内置浅色/深色主题切换。
- **跨端一致**：Web 与 Electron 共用 React 前端，UI 布局与交互完全一致；窗口可自由缩放，响应式自适应。

---

## 🧱 技术架构

```
┌──────────────────────────────────────────────────────────┐
│                      前端 (React + Vite)                    │
│  Header / Sidebar / NewsFeed / NewsCard / SettingsDialog   │
│  - SSE 实时订阅 (/api/news/stream)                         │
│  - Service Worker 离线缓存 + localStorage 缓存             │
└───────────────┬───────────────────────────┬──────────────┘
                │ 相对路径 /api              │
┌───────────────▼───────────────────────────▼──────────────┐
│                   Express 后端 (server/)                    │
│  REST API · SSE · 静态托管(dist)                           │
│  ├─ newsAgent.ts   CodeBuddy Agent SDK 抓取（智能）        │
│  ├─ rss.ts         直连 RSS/Atom 抓取（回退/直连模式）       │
│  ├─ scheduler.ts    定时调度 + 事件广播                     │
│  └─ db.ts           JSON 文件存储（无原生依赖，便于打包）    │
└──────────────────────────────────────────────────────────┘
                │
┌───────────────▼───────────────────────────┐
│   Electron 主进程 (electron/main.cjs)        │
│   同进程启动后端 → 加载同源页面 → 桌面客户端   │
└─────────────────────────────────────────────┘
```

**技术栈**：React 18 · TypeScript · Tailwind CSS · Express 4 · CodeBuddy Agent SDK (`@tencent-ai/agent-sdk`) ·
fast-xml-parser（RSS 解析）· SSE · Electron + electron-builder。

> 说明：数据存储采用纯 JSON 文件（`data/db.json`），不依赖 `better-sqlite3` 等原生模块，从而避免了
> 原生编译与 Electron 打包（`electron-rebuild`）的烦恼，做到 Web / Electron 一致运行。

---

## 📁 项目结构

```
ai-news-agent/
├── server/                 # 后端（Express + Agent SDK）
│   ├── index.ts            # 入口：API / SSE / 静态托管
│   ├── db.ts               # JSON 存储（资讯 / 数据源 / 配置）
│   ├── newsAgent.ts        # CodeBuddy Agent SDK 抓取
│   ├── rss.ts              # 直连 RSS/Atom 抓取与解析
│   ├── scheduler.ts        # 定时调度 + 广播
│   ├── events.ts           # SSE 事件总线
│   └── types.ts            # 服务端类型
├── src/                    # 前端（React + Vite）
│   ├── App.tsx
│   ├── api.ts              # API 客户端
│   ├── types.ts / config.ts
│   ├── hooks/              # useNews / useConfig
│   ├── components/         # Header / Sidebar / NewsFeed / NewsCard / SettingsDialog / Toast
│   └── utils/format.ts
├── electron/               # 桌面封装
│   ├── main.cjs            # 主进程：启动后端 + 加载页面
│   └── preload.cjs
├── public/                 # 静态资源（manifest / sw.js / favicon）
├── data/                   # 运行时数据（db.json，自动生成，已 gitignore）
├── dist/                   # 前端构建产物（electron-builder 自动生成）
├── dist-server/            # 后端打包产物（esbuild 生成）
├── package.json
└── README.md
```

---

## 🚀 快速开始（Web 版）

### 1. 安装依赖
```bash
npm install
```

### 2. 配置（可选）
复制 `.env.example` 为 `.env`，填入 CodeBuddy API Key 以启用 Agent 智能抓取：
```bash
cp .env.example .env
# 编辑 .env: CODEBUDDY_API_KEY=你的Key
```
> 不配置 Key 也能运行：系统会自动使用「直连 RSS 抓取」模式。

### 3. 启动开发（前后端热更新）
```bash
npm run dev
# 前端: http://localhost:5173   后端: http://localhost:3000
```

### 4. 生产构建（静态产物，可部署到任意 Web 服务器）
```bash
npm run build        # 生成 dist/
npm run server       # 启动 Express，托管 dist/ 并提供 API
# 访问 http://localhost:3000
```

---

## 🖥️ 桌面版（Electron）

### 开发模式
```bash
npm run electron:dev     # 启动后端(tsx) + Electron 窗口(加载 Vite 5173)
```

### 打包为桌面应用
```bash
npm run dist             # = build + build:server + electron-builder
# 产物位于 release/（Windows: .exe / macOS: .dmg / Linux: .AppImage）
```
打包时 Electron 会在**同一进程内**启动后端（`dist-server/index.cjs`）并加载同源页面，
因此 UI 布局、交互与 Web 版完全一致；窗口可自由缩放，离线数据由 `userData` 目录下的 `db.json` 持久化。

---

## ⚙️ 配置说明

应用运行后可点击右上角「设置」进行配置：

| 配置项 | 说明 |
| --- | --- |
| 自动定时抓取 | 总开关；关闭后仅手动抓取 |
| 抓取模式 | `混合`（默认，优先 Agent，失败回退直连）/ `仅 Agent` / `仅直连` |
| 抓取间隔 | 5 / 10 / 15 / 30 / 60 / 120 / 360 分钟，或自定义 |
| CodeBuddy API Key | 启用 Agent 模式所需；运行时设置，进程内生效 |
| 数据源 | 内置 9 个 RSS 源，支持增删改、启停、指定分类 |

---

## 📦 发布到 GitHub

本项目已初始化 Git 仓库，可直接推送到你的 GitHub：

```bash
git remote add origin https://github.com/<你的用户名>/ai-news-agent.git
git add .
git commit -m "feat: AI News Agent (CodeBuddy SDK + Electron)"
git push -u origin main
```

> 注意：`data/`、`dist/`、`dist-server/`、`node_modules/`、`release/` 已在 `.gitignore` 中忽略，
> 不会进入版本库；运行时数据在本地生成。

---

## 📄 许可证

MIT
