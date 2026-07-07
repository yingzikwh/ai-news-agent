// 抓取调度器：按配置间隔自动运行 Agent / 直连抓取，并向 SSE 客户端推送
import * as db from './db.js';
import { runNewsAgent } from './newsAgent.js';
import { fetchAllSources } from './rss.js';
import { broadcast } from './events.js';
import { RawNewsItem } from './types.js';

let timer: NodeJS.Timeout | null = null;
let running = false;
let started = false;

async function runFetchCycle(): Promise<{ added: number; mode: string }> {
  if (running) return { added: 0, mode: 'busy' };
  running = true;
  broadcast({ type: 'status', message: '正在抓取最新资讯…', mode: 'running' });
  try {
    const cfg = db.getConfig();
    const sources = db.getSources();
    let items: RawNewsItem[] = [];
    let mode = cfg.agentMode;
    const hasKey = !!process.env.CODEBUDDY_API_KEY;

    // 未配置 API Key 时跳过 Agent 调用（避免等待登录而卡住），直接走直连
    const canUseAgent = cfg.agentMode !== 'direct' && hasKey;

    if (canUseAgent) {
      try {
        items = await runNewsAgent({ sources, model: cfg.model, systemPrompt: cfg.systemPrompt });
      } catch (e) {
        console.error('[Scheduler] Agent 抓取异常:', e);
        items = [];
      }
    }

    // 回退：Agent 未产出 / 纯直连模式 / 无 API Key
    if (items.length === 0) {
      items = await fetchAllSources(sources);
      if (cfg.agentMode === 'agent') mode = 'direct-fallback';
      else if (!hasKey && cfg.agentMode === 'hybrid') mode = 'direct (无 API Key)';
      else mode = 'direct';
    }

    let added = 0;
    for (const it of items) {
      if (db.upsertItem(it)) added++;
    }
    db.updateConfig({ lastFetchAt: new Date().toISOString() });

    if (added > 0) {
      broadcast({ type: 'news', items: db.getNewItems(added) });
    }
    broadcast({ type: 'stats', stats: db.getStats() });
    broadcast({
      type: 'status',
      message: added > 0 ? `本次新增 ${added} 条资讯（${mode}）` : `本次无新增（${mode}）`,
      mode: 'idle',
    });
    console.log(`[Scheduler] 完成抓取，新增 ${added} 条（模式：${mode}）`);
    return { added, mode };
  } finally {
    running = false;
  }
}

function scheduleNext() {
  if (timer) clearTimeout(timer);
  const cfg = db.getConfig();
  const ms = Math.max(1, cfg.intervalMinutes) * 60 * 1000;
  timer = setTimeout(async () => {
    if (db.getConfig().isRunning) {
      await runFetchCycle();
    }
    scheduleNext();
  }, ms);
  console.log(`[Scheduler] 下次抓取将在 ${cfg.intervalMinutes} 分钟后`); // eslint-disable-line
}

export function startScheduler(): void {
  if (started) return;
  started = true;
  const cfg = db.getConfig();
  if (cfg.isRunning) {
    scheduleNext();
    // 启动后立即抓取一次
    runFetchCycle().catch((e) => console.error('[Scheduler] 初次抓取失败:', e));
  } else {
    console.log('[Scheduler] 自动抓取已关闭（可在设置中开启）');
  }
}

export function setRunning(isRunning: boolean): void {
  db.updateConfig({ isRunning });
  if (isRunning) {
    if (!started) startScheduler();
    else if (!running) runFetchCycle().catch(() => {});
  }
}

export function triggerNow(): Promise<{ added: number; mode: string }> {
  return runFetchCycle();
}

export function isBusy(): boolean {
  return running;
}
