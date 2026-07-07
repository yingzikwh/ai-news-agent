// 纯 JSON 文件存储（无原生依赖，便于在浏览器/Electron 中一致运行）
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import {
  AppConfig,
  Category,
  NewsFilters,
  NewsItem,
  NewsListResult,
  RawNewsItem,
  Source,
  Stats,
  VALID_CATEGORIES,
} from './types.js';

// 兼容两种运行环境：开发(tsx/ESM)走 import.meta.url；生产(esbuild 打包为 CJS)由 esbuild/tsx 注入 __dirname
declare const __dirname: string;
const APP_DIR = (() => {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return __dirname;
  }
})();

// 数据目录：Electron 打包后使用用户数据目录（asar 只读），开发时使用项目 data/
const dataDir = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'ai-news-agent')
  : path.join(APP_DIR, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'db.json');

const DEFAULT_CONFIG: AppConfig = {
  intervalMinutes: 15,
  agentMode: 'hybrid',
  model: process.env.CODEBUDDY_MODEL || 'claude-sonnet-4',
  systemPrompt: '',
  lastFetchAt: null,
  isRunning: process.env.AUTO_FETCH !== 'false',
};

// 默认数据源：覆盖国内外主流 AI 资讯站、厂商官方博客、学术预印本、政策监管机构。
// 包含 RSS（可被直连回退模式解析）与 Web（由 Agent 用浏览器工具访问）两类。
// 注意：原 9 个源 URL 必须保留，迁移逻辑按 URL 去重，避免重复添加。
const DEFAULT_SOURCES: Source[] = [
  // ===== 国际学术 / 研究（RSS）=====
  { id: uuidv4(), name: 'arXiv cs.AI', url: 'http://export.arxiv.org/rss/cs.AI', type: 'rss', enabled: true, categoryHint: 'academic' },
  { id: uuidv4(), name: 'arXiv cs.CL', url: 'http://export.arxiv.org/rss/cs.CL', type: 'rss', enabled: true, categoryHint: 'academic' },
  { id: uuidv4(), name: 'arXiv cs.LG', url: 'http://export.arxiv.org/rss/cs.LG', type: 'rss', enabled: true, categoryHint: 'academic' },
  { id: uuidv4(), name: 'arXiv cs.CV', url: 'http://export.arxiv.org/rss/cs.CV', type: 'rss', enabled: true, categoryHint: 'academic' },
  { id: uuidv4(), name: 'BAIR Blog', url: 'https://bair.berkeley.edu/blog/feed/', type: 'rss', enabled: true, categoryHint: 'academic' },
  { id: uuidv4(), name: 'Papers With Code', url: 'https://paperswithcode.com/', type: 'web', enabled: true, categoryHint: 'academic' },

  // ===== 国际厂商 / 模型发布（RSS + Web）=====
  { id: uuidv4(), name: 'OpenAI', url: 'https://openai.com/news', type: 'web', enabled: true, categoryHint: 'model_release' },
  { id: uuidv4(), name: 'Anthropic News', url: 'https://www.anthropic.com/news', type: 'web', enabled: true, categoryHint: 'model_release' },
  { id: uuidv4(), name: 'Google DeepMind', url: 'https://deepmind.google/blog/', type: 'web', enabled: true, categoryHint: 'model_release' },
  { id: uuidv4(), name: 'Google Research Blog', url: 'https://research.google/blog/rss/', type: 'rss', enabled: true, categoryHint: 'industry' },
  { id: uuidv4(), name: 'Microsoft Research', url: 'https://www.microsoft.com/en-us/research/feed/', type: 'rss', enabled: true, categoryHint: 'industry' },
  { id: uuidv4(), name: 'Meta AI', url: 'https://ai.meta.com/blog/', type: 'web', enabled: true, categoryHint: 'model_release' },
  { id: uuidv4(), name: 'Hugging Face Blog', url: 'https://huggingface.co/blog/feed.xml', type: 'rss', enabled: true, categoryHint: 'model_release' },
  { id: uuidv4(), name: 'NVIDIA Developer Blog', url: 'https://developer.nvidia.com/blog/feed/', type: 'rss', enabled: true, categoryHint: 'tool_update' },
  { id: uuidv4(), name: 'Mistral AI', url: 'https://mistral.ai/news/', type: 'web', enabled: true, categoryHint: 'model_release' },
  { id: uuidv4(), name: 'Stability AI', url: 'https://stability.ai/news', type: 'web', enabled: true, categoryHint: 'model_release' },
  { id: uuidv4(), name: 'Cohere', url: 'https://cohere.com/blog', type: 'web', enabled: true, categoryHint: 'model_release' },

  // ===== 国际行业媒体（RSS）=====
  { id: uuidv4(), name: 'The Verge · AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', type: 'rss', enabled: true, categoryHint: 'industry' },
  { id: uuidv4(), name: 'MIT Tech Review · AI', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed', type: 'rss', enabled: true, categoryHint: 'industry' },
  { id: uuidv4(), name: 'VentureBeat · AI', url: 'https://venturebeat.com/category/ai/feed/', type: 'rss', enabled: true, categoryHint: 'industry' },
  { id: uuidv4(), name: 'Wired · AI', url: 'https://www.wired.com/feed/tag/ai/latest/rss', type: 'rss', enabled: true, categoryHint: 'industry' },
  { id: uuidv4(), name: 'Ars Technica · AI', url: 'https://arstechnica.com/ai/feed/', type: 'rss', enabled: true, categoryHint: 'industry' },
  { id: uuidv4(), name: 'MarkTechPost', url: 'https://www.marktechpost.com/feed/', type: 'rss', enabled: true, categoryHint: 'industry' },
  { id: uuidv4(), name: 'TechCrunch · AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', type: 'rss', enabled: true, categoryHint: 'industry' },
  { id: uuidv4(), name: 'The Batch (deeplearning.ai)', url: 'https://www.deeplearning.ai/the-batch/feed/', type: 'rss', enabled: true, categoryHint: 'industry' },
  { id: uuidv4(), name: 'Ben\'s Bites', url: 'https://bensbites.beehiiv.com/feed', type: 'rss', enabled: true, categoryHint: 'industry' },
  { id: uuidv4(), name: 'Import AI', url: 'https://importai.substack.com/feed', type: 'rss', enabled: true, categoryHint: 'industry' },
  { id: uuidv4(), name: 'The Rundown AI', url: 'https://www.therundown.ai/feed', type: 'rss', enabled: true, categoryHint: 'industry' },

  // ===== 国际政策 / 监管（Web）=====
  { id: uuidv4(), name: 'White House · AI', url: 'https://www.whitehouse.gov/presidential-actions/', type: 'web', enabled: true, categoryHint: 'policy' },
  { id: uuidv4(), name: 'NIST · AI', url: 'https://www.nist.gov/artificial-intelligence', type: 'web', enabled: true, categoryHint: 'policy' },
  { id: uuidv4(), name: 'FTC · AI', url: 'https://www.ftc.gov/news-events/topics/artificial-intelligence', type: 'web', enabled: true, categoryHint: 'policy' },
  { id: uuidv4(), name: 'EU AI Act (European Commission)', url: 'https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai', type: 'web', enabled: true, categoryHint: 'policy' },
  { id: uuidv4(), name: 'UK Gov · AI', url: 'https://www.gov.uk/government/collections/artificial-intelligence', type: 'web', enabled: true, categoryHint: 'policy' },
  { id: uuidv4(), name: 'OECD · AI', url: 'https://oecd.ai/', type: 'web', enabled: true, categoryHint: 'policy' },

  // ===== 国内中文媒体（RSS）=====
  { id: uuidv4(), name: '机器之心', url: 'https://www.jiqizhixin.com/rss', type: 'rss', enabled: true, categoryHint: 'industry' },
  { id: uuidv4(), name: '量子位', url: 'https://www.qbitai.com/feed', type: 'rss', enabled: true, categoryHint: 'industry' },
  { id: uuidv4(), name: '36氪', url: 'https://36kr.com/feed', type: 'rss', enabled: true, categoryHint: 'industry' },
  { id: uuidv4(), name: '极客公园', url: 'https://www.geekpark.net/rss', type: 'rss', enabled: true, categoryHint: 'industry' },
  { id: uuidv4(), name: '雷峰网', url: 'https://www.leiphone.com/rss', type: 'rss', enabled: true, categoryHint: 'industry' },
  { id: uuidv4(), name: '钛媒体', url: 'https://www.tmtpost.com/rss.xml', type: 'rss', enabled: true, categoryHint: 'industry' },
  { id: uuidv4(), name: 'InfoQ 中文', url: 'https://www.infoq.cn/feed', type: 'rss', enabled: true, categoryHint: 'tool_update' },
  { id: uuidv4(), name: '智东西', url: 'https://www.zhidx.com/feed', type: 'rss', enabled: true, categoryHint: 'industry' },
  { id: uuidv4(), name: 'CSDN', url: 'https://www.csdn.net/feed', type: 'rss', enabled: true, categoryHint: 'tool_update' },

  // ===== 国内厂商 / 模型发布（Web）=====
  { id: uuidv4(), name: '百度文心', url: 'https://wenxin.baidu.com/', type: 'web', enabled: true, categoryHint: 'model_release' },
  { id: uuidv4(), name: '阿里通义', url: 'https://tongyi.aliyun.com/', type: 'web', enabled: true, categoryHint: 'model_release' },
  { id: uuidv4(), name: '腾讯 AI Lab', url: 'https://ai.tencent.com/', type: 'web', enabled: true, categoryHint: 'model_release' },
  { id: uuidv4(), name: '字节跳动', url: 'https://www.bytedance.com/', type: 'web', enabled: true, categoryHint: 'industry' },
  { id: uuidv4(), name: '华为昇腾', url: 'https://www.hiascend.com/', type: 'web', enabled: true, categoryHint: 'model_release' },
  { id: uuidv4(), name: '智源研究院 BAAI', url: 'https://www.baai.ac.cn/', type: 'web', enabled: true, categoryHint: 'model_release' },
  { id: uuidv4(), name: '上海人工智能实验室', url: 'https://www.shlab.org.cn/', type: 'web', enabled: true, categoryHint: 'model_release' },
  { id: uuidv4(), name: 'DeepSeek', url: 'https://www.deepseek.com/', type: 'web', enabled: true, categoryHint: 'model_release' },
  { id: uuidv4(), name: '智谱 AI', url: 'https://www.zhipuai.cn/', type: 'web', enabled: true, categoryHint: 'model_release' },
  { id: uuidv4(), name: '月之暗面 Kimi', url: 'https://www.moonshot.cn/', type: 'web', enabled: true, categoryHint: 'model_release' },

  // ===== 国内政策 / 监管（Web）=====
  { id: uuidv4(), name: '国家网信办', url: 'http://www.cac.gov.cn/', type: 'web', enabled: true, categoryHint: 'policy' },
  { id: uuidv4(), name: '工业和信息化部', url: 'https://www.miit.gov.cn/', type: 'web', enabled: true, categoryHint: 'policy' },
  { id: uuidv4(), name: '国家发展改革委', url: 'https://www.ndrc.gov.cn/', type: 'web', enabled: true, categoryHint: 'policy' },
];

interface DBShape {
  items: NewsItem[];
  sources: Source[];
  config: AppConfig;
  /** 已补齐过的默认数据源 URL，用于迁移去重（避免重复添加/复活被删默认源） */
  seededDefaultUrls?: string[];
}

let state: DBShape = load();
let saveTimer: NodeJS.Timeout | null = null;

function load(): DBShape {
  try {
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<DBShape>;
      const sources =
        parsed.sources && parsed.sources.length ? parsed.sources : DEFAULT_SOURCES;

      // 迁移：一次性补齐默认新增数据源（按 URL 去重）。
      // seededDefaultUrls 记录“已经补齐过”的默认源 URL：
      //   - 未补齐过的默认源 → 追加进现有列表（仅此一次）
      //   - 已补齐过但用户删除了的默认源 → 不复活，避免骚扰用户
      const presentUrls = new Set(sources.map((s) => s.url));
      const seeded = new Set(parsed.seededDefaultUrls || []);
      const toAdd = DEFAULT_SOURCES.filter(
        (d) => !presentUrls.has(d.url) && !seeded.has(d.url)
      );
      let mutated = false;
      if (toAdd.length) {
        sources.push(...toAdd);
        mutated = true;
      }
      // 把所有默认源 URL 合并进 seeded 集合
      const newSeeded = new Set([...seeded, ...DEFAULT_SOURCES.map((d) => d.url)]);
      const seededChanged = newSeeded.size !== seeded.size;

      const result: DBShape = {
        items: parsed.items || [],
        sources,
        config: { ...DEFAULT_CONFIG, ...(parsed.config || {}) },
        seededDefaultUrls: [...newSeeded],
      };

      if (mutated || seededChanged) {
        // 异步落盘合并结果（不阻塞启动）
        setTimeout(() => {
          try {
            fs.writeFileSync(dbPath, JSON.stringify(result, null, 2));
          } catch (e) {
            console.error('[DB] 迁移写入失败:', e);
          }
        }, 0);
      }
      return result;
    }
  } catch (e) {
    console.error('[DB] 读取失败，使用默认数据:', e);
  }
  // 首次运行：以完整默认源初始化，并记录全部默认 URL 以备后续迁移判断
  return {
    items: [],
    sources: DEFAULT_SOURCES,
    config: { ...DEFAULT_CONFIG },
    seededDefaultUrls: DEFAULT_SOURCES.map((d) => d.url),
  };
}

function persist() {
  // 防抖写入，避免高频抓取时反复 IO
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(dbPath, JSON.stringify(state, null, 2));
    } catch (e) {
      console.error('[DB] 写入失败:', e);
    }
  }, 200);
}

function normalizeCategory(c: string | undefined): Category {
  if (!c) return 'other';
  const key = c.toLowerCase().trim();
  if ((VALID_CATEGORIES as string[]).includes(key)) return key as Category;
  return 'other';
}

// ============= News Items =============

export function getItems(filters: NewsFilters = {}): NewsListResult {
  let items = [...state.items];
  if (filters.category && filters.category !== 'all') {
    items = items.filter((i) => i.category === filters.category);
  }
  if (filters.favoritesOnly) items = items.filter((i) => i.isFavorite);
  if (filters.unreadOnly) items = items.filter((i) => !i.isRead);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    items = items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        (i.summary || '').toLowerCase().includes(q) ||
        (i.source || '').toLowerCase().includes(q) ||
        (i.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  }
  items.sort((a, b) => {
    const ta = a.publishedAt || a.fetchedAt;
    const tb = b.publishedAt || b.fetchedAt;
    return tb.localeCompare(ta);
  });

  const total = items.length;
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(200, Math.max(1, filters.limit || 50));
  const start = (page - 1) * limit;
  const paged = items.slice(start, start + limit);
  return { items: paged, total, page, limit, hasMore: start + limit < total };
}

export function getItem(id: string): NewsItem | undefined {
  return state.items.find((i) => i.id === id);
}

/** 插入或更新（按 url 去重）。返回是否新增。 */
export function upsertItem(raw: RawNewsItem): boolean {
  const url = (raw.url || '').trim();
  if (!url || !raw.title) return false;
  const existing = state.items.find((i) => i.url === url);
  if (existing) {
    // 已存在则补充缺失字段（如分类/摘要），不重复插入
    let updated = false;
    if (!existing.summary && raw.summary) { existing.summary = raw.summary; updated = true; }
    if (existing.category === 'other' && raw.category && raw.category !== 'other') {
      existing.category = normalizeCategory(raw.category); updated = true;
    }
    if (updated) persist();
    return false;
  }
  const item: NewsItem = {
    id: uuidv4(),
    title: raw.title.trim(),
    url,
    summary: raw.summary?.trim() || '',
    source: raw.source || '未知来源',
    category: normalizeCategory(raw.category),
    publishedAt: raw.publishedAt || new Date().toISOString(),
    tags: raw.tags || [],
    fetchedAt: new Date().toISOString(),
    isRead: false,
    isFavorite: false,
  };
  state.items.unshift(item);
  // 限制本地存储上限，避免无限增长
  if (state.items.length > 5000) state.items = state.items.slice(0, 5000);
  persist();
  return true;
}

export function markRead(id: string, isRead: boolean): boolean {
  const item = getItem(id);
  if (!item) return false;
  item.isRead = isRead;
  persist();
  return true;
}

export function markAllRead(): number {
  let n = 0;
  for (const i of state.items) if (!i.isRead) { i.isRead = true; n++; }
  if (n) persist();
  return n;
}

export function toggleFavorite(id: string): NewsItem | undefined {
  const item = getItem(id);
  if (!item) return undefined;
  item.isFavorite = !item.isFavorite;
  persist();
  return item;
}

/** 写入中文翻译结果 */
export function setTranslation(
  id: string,
  translatedTitle: string,
  translatedSummary: string
): NewsItem | undefined {
  const item = getItem(id);
  if (!item) return undefined;
  item.translatedTitle = translatedTitle;
  item.translatedSummary = translatedSummary || '';
  item.translatedAt = new Date().toISOString();
  persist();
  return item;
}

export function getNewItems(count: number): NewsItem[] {
  return state.items.slice(0, count);
}

export function getStats(): Stats {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  return {
    total: state.items.length,
    unread: state.items.filter((i) => !i.isRead).length,
    favorites: state.items.filter((i) => i.isFavorite).length,
    today: state.items.filter((i) => (i.publishedAt || i.fetchedAt) >= startOfDay).length,
    lastFetchAt: state.config.lastFetchAt,
    isRunning: state.config.isRunning,
  };
}

// ============= Sources =============

export function getSources(): Source[] {
  return state.sources;
}

export function addSource(s: Omit<Source, 'id'>): Source {
  const source: Source = { ...s, id: uuidv4() };
  state.sources.push(source);
  persist();
  return source;
}

export function updateSource(id: string, patch: Partial<Omit<Source, 'id'>>): Source | undefined {
  const s = state.sources.find((x) => x.id === id);
  if (!s) return undefined;
  Object.assign(s, patch);
  persist();
  return s;
}

export function deleteSource(id: string): boolean {
  const before = state.sources.length;
  state.sources = state.sources.filter((x) => x.id !== id);
  const removed = before !== state.sources.length;
  if (removed) persist();
  return removed;
}

// ============= Config =============

export function getConfig(): AppConfig {
  return { ...state.config };
}

export function updateConfig(patch: Partial<AppConfig>): AppConfig {
  state.config = { ...state.config, ...patch };
  persist();
  return { ...state.config };
}

export default {
  getItems,
  getItem,
  upsertItem,
  markRead,
  markAllRead,
  toggleFavorite,
  setTranslation,
  getNewItems,
  getStats,
  getSources,
  addSource,
  updateSource,
  deleteSource,
  getConfig,
  updateConfig,
};
