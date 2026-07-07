import type { ReactNode } from 'react';
import { Bookmark, Filter, Layers, Rss, Star } from 'lucide-react';
import { CATEGORIES, NewsFilters, NewsItem, Stats } from '../types';

interface Props {
  filters: NewsFilters;
  setFilters: (f: NewsFilters) => void;
  items: NewsItem[];
  stats: Stats;
}

export default function Sidebar({ filters, setFilters, items, stats }: Props) {
  // 基于当前已加载项计算各分类数量（近似）
  const counts: Record<string, number> = {};
  for (const it of items) counts[it.category] = (counts[it.category] || 0) + 1;

  const row = (
    active: boolean,
    onClick: () => void,
    icon: ReactNode,
    label: string,
    badge?: number,
    badgeColor = 'bg-brand-500'
  ) => (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
        active
          ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge != null && badge > 0 && (
        <span className={`min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold text-white ${badgeColor}`}>
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        资讯流
      </div>
      {row(
        filters.category === 'all' && !filters.favoritesOnly && !filters.unreadOnly,
        () => setFilters({ category: 'all', search: filters.search, favoritesOnly: false, unreadOnly: false }),
        <Rss className="h-4 w-4" />, '全部资讯', stats.total
      )}
      {row(
        filters.unreadOnly,
        () => setFilters({ ...filters, unreadOnly: !filters.unreadOnly }),
        <span className="h-2 w-2 rounded-full bg-brand-500" />, '未读', stats.unread
      )}
      {row(
        filters.favoritesOnly,
        () => setFilters({ ...filters, favoritesOnly: !filters.favoritesOnly }),
        <Star className="h-4 w-4" />, '我的收藏', stats.favorites, 'bg-amber-500'
      )}

      <div className="mt-4 flex items-center gap-1.5 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        <Layers className="h-3.5 w-3.5" /> 分类筛选
      </div>
      {CATEGORIES.map((c) => (
        <div key={c.key}>
          {row(
            filters.category === c.key && !filters.favoritesOnly && !filters.unreadOnly,
            () => setFilters({ category: c.key, search: filters.search, favoritesOnly: false, unreadOnly: false }),
            <span className="h-2 w-2 rounded-full bg-slate-400" />, c.label, counts[c.key] || 0, 'bg-slate-400'
          )}
        </div>
      ))}

      <div className="mt-auto rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-400 dark:bg-slate-800/60">
        <Filter className="mb-1 h-3.5 w-3.5" />
        抓取结果实时推送，支持离线缓存与收藏。配置数据源与频率请点击右上角设置。
      </div>
    </aside>
  );
}
