// 服务端共享类型定义

export type Category =
  | 'model_release'
  | 'industry'
  | 'academic'
  | 'tool_update'
  | 'policy'
  | 'other';

export interface RawNewsItem {
  title: string;
  url: string;
  summary?: string;
  source?: string;
  category?: Category | string;
  publishedAt?: string; // ISO8601
  tags?: string[];
}

export interface NewsItem extends RawNewsItem {
  id: string;
  fetchedAt: string; // ISO8601
  isRead: boolean;
  isFavorite: boolean;
  translatedTitle?: string; // 中文翻译（标题）
  translatedSummary?: string; // 中文翻译（摘要）
  translatedAt?: string; // 翻译时间 ISO8601
}

export type SourceType = 'rss' | 'web';

export interface Source {
  id: string;
  name: string;
  url: string;
  type: SourceType;
  enabled: boolean;
  categoryHint?: Category;
}

export type AgentMode = 'agent' | 'direct' | 'hybrid';

export interface AppConfig {
  intervalMinutes: number;
  agentMode: AgentMode;
  model: string;
  systemPrompt: string;
  lastFetchAt: string | null;
  isRunning: boolean;
}

export interface NewsFilters {
  category?: Category | 'all';
  search?: string;
  favoritesOnly?: boolean;
  unreadOnly?: boolean;
  page?: number;
  limit?: number;
}

export interface NewsListResult {
  items: NewsItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface Stats {
  total: number;
  unread: number;
  favorites: number;
  today: number;
  lastFetchAt: string | null;
  isRunning: boolean;
}

// 分类元数据（服务端用于校验/归类）
export const CATEGORY_LABELS: Record<Category, string> = {
  model_release: '模型发布',
  industry: '行业动态',
  academic: '学术论文',
  tool_update: '工具更新',
  policy: '政策监管',
  other: '其他',
};

export const VALID_CATEGORIES: Category[] = [
  'model_release',
  'industry',
  'academic',
  'tool_update',
  'policy',
  'other',
];
