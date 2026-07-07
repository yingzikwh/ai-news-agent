import { Inbox, Loader2, WifiOff } from 'lucide-react';
import { NewsItem } from '../types';
import NewsCard from './NewsCard';

interface Props {
  items: NewsItem[];
  loading: boolean;
  hasMore: boolean;
  total: number;
  offline: boolean;
  onLoadMore: () => void;
  onToggleFavorite: (id: string) => void;
  onMarkRead: (id: string, read: boolean) => void;
  onTranslate: (id: string) => Promise<boolean>;
}

export default function NewsFeed({
  items, loading, hasMore, total, offline, onLoadMore, onToggleFavorite, onMarkRead, onTranslate,
}: Props) {
  if (items.length === 0 && !loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center text-slate-400">
        <Inbox className="h-12 w-12" />
        <div className="text-lg font-medium text-slate-500 dark:text-slate-300">暂无资讯</div>
        <div className="max-w-xs text-sm">
          {offline ? '当前处于离线状态，展示的是本地缓存。' : '点击右上角「立即抓取」开始获取 AI 最新资讯，或在设置中配置数据源与频率。'}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      {offline && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          <WifiOff className="h-4 w-4" /> 离线模式：已显示本地缓存的 {items.length} 条资讯
        </div>
      )}

      <div className="mb-3 text-xs text-slate-400">
        共 {total} 条{items.length !== total ? `（已加载 ${items.length} 条）` : ''}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <NewsCard
            key={item.id}
            item={item}
            onToggleFavorite={onToggleFavorite}
            onMarkRead={onMarkRead}
            onTranslate={onTranslate}
          />
        ))}
      </div>

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            加载更多
          </button>
        </div>
      )}
    </div>
  );
}
