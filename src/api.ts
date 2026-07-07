// 前端 API 客户端（基于相对路径 /api，兼容 Web 与 Electron）
import {
  AppConfig,
  Category,
  NewsFilters,
  NewsItem,
  NewsListResult,
  Source,
  Stats,
} from './types';

const BASE = '';

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `请求失败 (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getNews: (filters: Partial<NewsFilters> & { page?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters.category && filters.category !== 'all') params.set('category', filters.category);
    if (filters.search) params.set('search', filters.search);
    if (filters.favoritesOnly) params.set('favorites', '1');
    if (filters.unreadOnly) params.set('unread', '1');
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));
    return req<NewsListResult>(`/api/news?${params.toString()}`);
  },
  getItem: (id: string) => req<NewsItem>(`/api/news/${id}`),
  markRead: (id: string, read: boolean) =>
    req(`/api/news/${id}/read`, { method: 'POST', body: JSON.stringify({ read }) }),
  toggleFavorite: (id: string) => req<{ success: boolean; isFavorite: boolean }>(
    `/api/news/${id}/favorite`, { method: 'POST' }
  ),
  markAllRead: () => req<{ success: boolean; count: number }>(`/api/news/read-all`, { method: 'POST' }),

  getCategories: () => req<{ categories: { key: Category; label: string }[] }>(`/api/categories`),
  getStats: () => req<Stats>(`/api/stats`),

  getSources: () => req<{ sources: Source[] }>(`/api/sources`),
  addSource: (s: Omit<Source, 'id'>) =>
    req<{ success: boolean; source: Source }>(`/api/sources`, {
      method: 'POST',
      body: JSON.stringify(s),
    }),
  updateSource: (id: string, patch: Partial<Source>) =>
    req<{ success: boolean; source: Source }>(`/api/sources/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),
  deleteSource: (id: string) =>
    req<{ success: boolean }>(`/api/sources/${id}`, { method: 'DELETE' }),

  getConfig: () => req<AppConfig & { hasApiKey: boolean; apiKeyMasked: string }>(`/api/config`),
  updateConfig: (patch: Partial<AppConfig> & { apiKey?: string }) =>
    req<{ success: boolean; config: AppConfig; hasApiKey: boolean }>(`/api/config`, {
      method: 'POST',
      body: JSON.stringify(patch),
    }),

  fetchNow: () =>
    req<{ success: true; added: number; mode: string }>(`/api/fetch-now`, { method: 'POST' }),
};

export default api;
