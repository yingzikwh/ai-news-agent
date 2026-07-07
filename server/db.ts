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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据目录：Electron 打包后使用用户数据目录（asar 只读），开发时使用项目 data/
const dataDir = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'ai-news-agent')
  : path.join(__dirname, '..', 'data');
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

const DEFAULT_SOURCES: Source[] = [
  { id: uuidv4(), name: 'arXiv cs.AI', url: 'http://export.arxiv.org/rss/cs.AI', type: 'rss', enabled: true, categoryHint: 'academic' },
  { id: uuidv4(), name: 'Google Research Blog', url: 'https://research.google/blog/rss/', type: 'rss', enabled: true, categoryHint: 'industry' },
  { id: uuidv4(), name: 'The Verge · AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', type: 'rss', enabled: true, categoryHint: 'industry' },
  { id: uuidv4(), name: 'MIT Tech Review · AI', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed', type: 'rss', enabled: true, categoryHint: 'industry' },
  { id: uuidv4(), name: 'VentureBeat · AI', url: 'https://venturebeat.com/category/ai/feed/', type: 'rss', enabled: true, categoryHint: 'industry' },
  { id: uuidv4(), name: 'Wired · AI', url: 'https://www.wired.com/feed/tag/ai/latest/rss', type: 'rss', enabled: true, categoryHint: 'industry' },
  { id: uuidv4(), name: 'Ars Technica · AI', url: 'https://arstechnica.com/ai/feed/', type: 'rss', enabled: true, categoryHint: 'industry' },
  { id: uuidv4(), name: 'MarkTechPost', url: 'https://www.marktechpost.com/feed/', type: 'rss', enabled: true, categoryHint: 'industry' },
  { id: uuidv4(), name: 'BAIR Blog', url: 'https://bair.berkeley.edu/blog/feed/', type: 'rss', enabled: true, categoryHint: 'academic' },
];

interface DBShape {
  items: NewsItem[];
  sources: Source[];
  config: AppConfig;
}

let state: DBShape = load();
let saveTimer: NodeJS.Timeout | null = null;

function load(): DBShape {
  try {
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<DBShape>;
      return {
        items: parsed.items || [],
        sources: parsed.sources && parsed.sources.length ? parsed.sources : DEFAULT_SOURCES,
        config: { ...DEFAULT_CONFIG, ...(parsed.config || {}) },
      };
    }
  } catch (e) {
    console.error('[DB] 读取失败，使用默认数据:', e);
  }
  return { items: [], sources: DEFAULT_SOURCES, config: { ...DEFAULT_CONFIG } };
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
  getNewItems,
  getStats,
  getSources,
  addSource,
  updateSource,
  deleteSource,
  getConfig,
  updateConfig,
};
