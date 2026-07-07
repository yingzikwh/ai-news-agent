// AI News Agent - Express 后端
// 负责：Agent/直连抓取调度、资讯存储、REST API、SSE 实时推送、托管前端静态资源
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as db from './db.js';
import { bus } from './events.js';
import { startScheduler, setRunning, triggerNow, isBusy } from './scheduler.js';
import { CATEGORY_LABELS, Category, VALID_CATEGORIES } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
app.use(express.json());

// 临时存储前端运行时设置的 API Key（仅进程内有效）
let runtimeApiKey = process.env.CODEBUDDY_API_KEY || '';

// ============= 健康检查 =============
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), busy: isBusy() });
});

// ============= 资讯列表 / 详情 =============
app.get('/api/news', (req, res) => {
  try {
    const category = (req.query.category as string) || 'all';
    const result = db.getItems({
      category: (category === 'all' ? 'all' : (category as Category)),
      search: (req.query.search as string) || undefined,
      favoritesOnly: req.query.favorites === '1',
      unreadOnly: req.query.unread === '1',
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 50,
    });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || '获取失败' });
  }
});

app.get('/api/news/:id', (req, res) => {
  const item = db.getItem(req.params.id);
  if (!item) return res.status(404).json({ error: '不存在' });
  res.json(item);
});

app.post('/api/news/:id/read', (req, res) => {
  const ok = db.markRead(req.params.id, req.body.read !== false);
  res.json({ success: ok });
});

app.post('/api/news/:id/favorite', (req, res) => {
  const item = db.toggleFavorite(req.params.id);
  if (!item) return res.status(404).json({ error: '不存在' });
  res.json({ success: true, isFavorite: item.isFavorite });
});

app.post('/api/news/read-all', (_req, res) => {
  const n = db.markAllRead();
  res.json({ success: true, count: n });
});

// ============= 分类 =============
app.get('/api/categories', (_req, res) => {
  res.json({
    categories: VALID_CATEGORIES.map((key) => ({ key, label: CATEGORY_LABELS[key] })),
  });
});

// ============= 数据源 =============
app.get('/api/sources', (_req, res) => {
  res.json({ sources: db.getSources() });
});

app.post('/api/sources', (req, res) => {
  const { name, url, type, enabled, categoryHint } = req.body;
  if (!name || !url) return res.status(400).json({ error: '名称和链接必填' });
  const source = db.addSource({
    name: String(name),
    url: String(url),
    type: type === 'web' ? 'web' : 'rss',
    enabled: enabled !== false,
    categoryHint: (VALID_CATEGORIES as string[]).includes(String(categoryHint))
      ? (categoryHint as Category)
      : undefined,
  });
  res.json({ success: true, source });
});

app.put('/api/sources/:id', (req, res) => {
  const s = db.updateSource(req.params.id, req.body);
  if (!s) return res.status(404).json({ error: '不存在' });
  res.json({ success: true, source: s });
});

app.delete('/api/sources/:id', (req, res) => {
  const ok = db.deleteSource(req.params.id);
  res.json({ success: ok });
});

// ============= 配置 =============
app.get('/api/config', (_req, res) => {
  const cfg = db.getConfig();
  res.json({
    ...cfg,
    hasApiKey: !!runtimeApiKey || !!process.env.CODEBUDDY_API_KEY,
    apiKeyMasked: runtimeApiKey || process.env.CODEBUDDY_API_KEY
      ? (process.env.CODEBUDDY_API_KEY || runtimeApiKey).slice(0, 6) + '****'
      : '',
  });
});

app.post('/api/config', (req, res) => {
  const { intervalMinutes, agentMode, model, systemPrompt, isRunning, apiKey } = req.body;
  if (apiKey && typeof apiKey === 'string' && apiKey.trim()) {
    runtimeApiKey = apiKey.trim();
    process.env.CODEBUDDY_API_KEY = runtimeApiKey; // 供后续 Agent 调用使用
  }
  if (intervalMinutes != null) {
    const v = Math.max(1, Math.min(1440, Number(intervalMinutes) || 15));
    db.updateConfig({ intervalMinutes: v });
  }
  if (agentMode) db.updateConfig({ agentMode });
  if (model) db.updateConfig({ model: String(model) });
  if (systemPrompt != null) db.updateConfig({ systemPrompt: String(systemPrompt) });
  if (isRunning != null) {
    const run = !!isRunning;
    db.updateConfig({ isRunning: run });
    setRunning(run);
  }
  res.json({ success: true, config: db.getConfig(), hasApiKey: !!runtimeApiKey });
});

// ============= 手动抓取 =============
app.post('/api/fetch-now', async (_req, res) => {
  try {
    const result = await triggerNow();
    res.json({ success: true, ...result });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || '抓取失败' });
  }
});

// ============= 统计 =============
app.get('/api/stats', (_req, res) => {
  res.json(db.getStats());
});

// ============= SSE 实时推送 =============
const clients = new Set<express.Response>();
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.write('retry: 3000\n\n');
  res.write(`data: ${JSON.stringify({ type: 'connected', stats: db.getStats() })}\n\n`);

  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);
  const onEvent = (e: any) => {
    try { res.write(`data: ${JSON.stringify(e)}\n\n`); } catch { /* ignore */ }
  };
  bus.on('event', onEvent);
  clients.add(res);

  req.on('close', () => {
    clearInterval(keepAlive);
    clients.delete(res);
    bus.off('event', onEvent);
  });
});

// ============= 托管前端静态资源 =============
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// 启动抓取调度器
startScheduler();

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║            ◉  AI News Agent 服务已启动             ║
║            地址: http://localhost:${PORT}             ║
║            API : http://localhost:${PORT}/api         ║
╚════════════════════════════════════════════════════╝
  `);
});

export { app };
