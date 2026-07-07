// AI News Agent - Electron 主进程
// 策略：在同一进程内启动 Express 后端（dist-server/index.cjs），再由窗口加载同源页面。
// - 生产：dist/ 存在 → 加载 http://localhost:3000（后端同时托管前端静态资源）
// - 开发：dist/ 不存在 → 加载 Vite 开发服务器 http://localhost:5173（后端由 npm run dev:server 提供）
const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow = null;
const API_PORT = process.env.PORT || 3000;

function waitForServer(url, cb) {
  const tryOnce = () => {
    const req = http.get(url, (res) => { res.destroy(); cb(true); });
    req.on('error', () => setTimeout(tryOnce, 400));
    req.setTimeout(1500, () => { req.destroy(); setTimeout(tryOnce, 400); });
  };
  tryOnce();
}

function createWindow() {
  const hasDist = fs.existsSync(path.join(__dirname, '..', 'dist', 'index.html'));
  const loadPort = hasDist ? API_PORT : 5173;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 860,
    minHeight: 600,
    title: 'AI News Agent',
    backgroundColor: '#0b1020',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    show: false,
  });

  mainWindow.loadURL('http://localhost:' + loadPort);
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // 窗口缩放保持布局：前端为响应式 CSS Grid/Flex，无需额外处理
}

app.whenReady().then(async () => {
  // 数据目录写入用户数据（asar 只读），供后端持久化 db.json
  process.env.DATA_DIR = app.getPath('userData');

  // 启动后端服务（生产环境下 dist-server/index.mjs 已由 esbuild 打包为 ESM）
  try {
    await import(path.join(__dirname, '..', 'dist-server', 'index.mjs'));
  } catch (e) {
    // 开发模式下 dist-server 未构建，后端由 dev:server 单独提供，此处忽略
    console.log('[Electron] 内置后端未启动（开发模式），将连接外部后端。');
  }

  // 等待后端健康接口就绪
  await new Promise((res) => waitForServer('http://localhost:' + API_PORT + '/api/health', res));
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
