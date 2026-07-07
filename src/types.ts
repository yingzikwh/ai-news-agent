export type Category =
  | 'model_release'
  | 'industry'
  | 'academic'
  | 'tool_update'
  | 'policy'
  | 'other';

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  summary: string;
  source: string;
  category: Category;
  publishedAt: string;
  fetchedAt: string;
  tags: string[];
  isRead: boolean;
  isFavorite: boolean;
  translatedTitle?: string;
  translatedSummary?: string;
  translatedAt?: string;
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
  hasApiKey?: boolean;
  apiKeyMasked?: string;
}

export interface NewsFilters {
  category: Category | 'all';
  search: string;
  favoritesOnly: boolean;
  unreadOnly: boolean;
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

export interface CategoryMeta {
  key: Category;
  label: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { key: 'model_release', label: '模型发布' },
  { key: 'industry', label: '行业动态' },
  { key: 'academic', label: '学术论文' },
  { key: 'tool_update', label: '工具更新' },
  { key: 'policy', label: '政策监管' },
  { key: 'other', label: '其他' },
];

export const CATEGORY_STYLE: Record<Category, { bg: string; text: string; dot: string }> = {
  model_release: { bg: 'bg-purple-100 text-purple-700', text: '模型发布', dot: 'bg-purple-500' },
  industry: { bg: 'bg-blue-100 text-blue-700', text: '行业动态', dot: 'bg-blue-500' },
  academic: { bg: 'bg-emerald-100 text-emerald-700', text: '学术论文', dot: 'bg-emerald-500' },
  tool_update: { bg: 'bg-amber-100 text-amber-700', text: '工具更新', dot: 'bg-amber-500' },
  policy: { bg: 'bg-rose-100 text-rose-700', text: '政策监管', dot: 'bg-rose-500' },
  other: { bg: 'bg-slate-100 text-slate-600', text: '其他', dot: 'bg-slate-400' },
};
