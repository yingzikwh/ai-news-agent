// AI News Agent - Electron 主进程
// 策略：在同一进程内启动 Express 后端（dist-server/index.cjs，CJS 以便 electron require 在 asar 内正常加载），
//       再由窗口加载同源页面。
// - 生产：dist/ 存在 → 加载 http://localhost:3000（后端同时托管前端静态资源）
// - 开发：dist/ 不存在 → 加载 Vite 开发服务器 http://localhost:5173（后端由 npm run dev:server 提供）
const fs = require('fs');
const os = require('os');
const path = require('path');

// 先定义日志（不依赖 electron），确保任何早期错误都能落盘
// 同时输出到 stderr，便于在打包环境排查（文件写入可能因权限失败）
const LOG = path.join(os.tmpdir(), 'ainews-electron.log');
function log(...a) {
  const msg = `[${new Date().toISOString()}] ` + a.map(x => (x && x.stack) || (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(' ');
  try { fs.appendFileSync(LOG, msg + '\n'); } catch {}
  try { console.error(msg); } catch {}
}
log('=== main.cjs 启动 === node', process.versions.node);

let app, BrowserWindow;
try {
  ({ app, BrowserWindow } = require('electron'));
  log('require(electron) OK, electron', process.versions.electron);
} catch (e) {
  log('require(electron) 失败:', e && e.stack || e);
  process.exit(1);
}
process.on('uncaughtException', (e) => { log('UNCAUGHT', e && e.stack || e); });
process.on('unhandledRejection', (e) => { log('UNHANDLED', e && e.stack || e); });

const http = require('http');

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

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  log('app.whenReady resolved');
  // 数据目录写入用户数据（asar 只读），供后端持久化 db.json
  process.env.DATA_DIR = app.getPath('userData');
  log('DATA_DIR =', process.env.DATA_DIR);

  // 启动后端服务（生产环境下 dist-server/index.cjs 由 esbuild 打包为 CJS，electron 的 require 可在 asar 内加载）
  try {
    const srv = path.join(__dirname, '..', 'dist-server', 'index.cjs');
    log('require server:', srv, 'exists=', fs.existsSync(srv));
    require(srv);
    log('server 加载完成');
  } catch (e) {
    log('server 加载失败:', e && e.stack || e);
    // 开发模式下 dist-server 未构建，后端由 dev:server 单独提供，此处忽略
    console.log('[Electron] 内置后端未启动（开发模式），将连接外部后端。');
  }

  // 等待后端健康接口就绪
  log('等待后端 health on', API_PORT);
  await new Promise((res) => waitForServer('http://localhost:' + API_PORT + '/api/health', res));
  log('后端就绪，创建窗口');
  try {
    createWindow();
    log('窗口已创建');
  } catch (e) {
    log('createWindow 失败:', e && e.stack || e);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
