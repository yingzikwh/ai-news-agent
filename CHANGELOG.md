# Changelog

本文件记录各版本的依赖升级、行为变更与验证方式。

## 2026-11-25 — 依赖栈大版本升级

本次把停滞在主版本（React 18 / Vite 5 / Tailwind 3 / Express 4 / Electron 33）的技术栈整体推进到当前稳定线，
并修掉了仓库里长期存在的 `typecheck` 报错。

### 版本变更

| 包 | 升级前 | 升级后 |
| --- | --- | --- |
| react / react-dom | 18.2 | 19.3 |
| lucide-react | 0.563 | 1.78 |
| vite | 5.0 | 7.3 |
| @vitejs/plugin-react | 4.2 | 5.2 |
| tailwindcss / @tailwindcss/postcss | 3.4 | 4.3 |
| express | 4.18 | 5.3 |
| @types/express | 4.17 | 5.0 |
| electron | 33.2 | 45.4 |
| electron-builder | 25.1 | 26.18 |
| fast-xml-parser | 4.5 | 5.12 |
| @tencent-ai/agent-sdk | 0.3.202 | 0.3.305 |
| typescript | 5.3 | 5.9 |
| tsx / esbuild / concurrently / wait-on | 4.6 / 0.24 / 8.2 / 8.0 | 4.23 / 0.28 / 10.0 / 9.5 |
| uuid | 9.0 | 已移除（改用 `node:crypto` 的 `randomUUID`） |

### 代码与配置改动

- `src/index.css`：`@tailwind base/components/utilities` 改为 `@import 'tailwindcss'`，
  并用 `@config` 继续加载 `tailwind.config.js`（保留 brand 色板），
  `@custom-variant dark` 保留 class 暗色模式。
- `postcss.config.js`：插件改为 `@tailwindcss/postcss`，移除 `autoprefixer`（Tailwind 4 内置前缀处理）。
- `server/db.ts`：`uuid` 的 `v4()` 替换为 Node 内置 `randomUUID()`。
  原因：uuid 14 为纯 ESM 包，而服务端以 esbuild 打成 CJS 且外置 node_modules，
  Electron 内 `require('uuid')` 会失败。顺带移除了 `uuid` 与 `@types/uuid` 依赖。
- `server/index.ts`：`req.body.read` 改为 `req.body?.read`。
  Express 5 在请求无 body 时把 `req.body` 置为 `undefined`，不加保护会抛 500。
- `src/vite-env.d.ts`（新增）：`/// <reference types="vite/client" />`，修复既有的
  `Property 'env' does not exist on type 'ImportMeta'` 报错。
- `tsconfig.json` / `tsconfig.node.json`：`tsc -b` 的构建信息与产物重定向到 `node_modules/.tmp`，
  不再在仓库根目录生成 `vite.config.js`、`vite.config.d.ts`、`*.tsbuildinfo`。

### 兼容性说明

- **Tailwind 4**：默认边框色、ring 宽度等默认值与 v3 不同；本项目未使用这些默认值依赖，页面实测无差异。
- **Express 5**：只有正则形式的 SPA 兜底路由（`app.get(/^(?!\/api).*/, …)`），在 v5 下语法不变；已实测。
- **React 19**：项目未使用 `findDOMNode` / `defaultProps` / `UNSAFE_*` 等旧 API，属于类型层面的升级。
- **uuid**：JSON 中历史数据的 id 仍是 uuid v4 格式，与新生成的 UUID 完全兼容，无需数据迁移。

### 验证记录

- `npm run typecheck`、`npm run build`、`npm run build:server`：全部通过。
- 接口实测：`/api/health`、`/api/news`、`/api/stats`、`/api/categories`、`/api/sources`（增删改）、
  `/api/news/:id/read`（有无请求体）、SSE `/api/stream`、SPA 兜底路由：均正常。
- RSS 直连抓取实测成功（单次 25 条），确认 fast-xml-parser 5 的解析行为与 v4 一致。
- 浏览器实测：列表渲染、图标、品牌色 `#3366ff`、暗色切换、控制台无报错。
- Electron：`electron-builder` 生成 `release/win-unpacked` 成功，asar 内 `dist/`、`dist-server/`、
  `electron/`、`package.json` 齐全，`@tencent-ai/**` 正确解包。

### 已知限制

- NSIS 安装包需要下载并执行 `makensis`，在受限制的执行环境下会失败（`spawn UNKNOWN`）；
  绿色版 `release/win-unpacked` 不受影响。如需安装包，请在常规桌面环境执行 `npm run dist`。
- 若 Electron 官方二进制下载缓慢，可设置 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` 后重试。

### 回滚

本次升级集中在依赖与 4 个源码/配置文件，回滚到上一提交即可恢复原状态。
