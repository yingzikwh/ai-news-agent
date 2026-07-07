import { ExternalLink, Star } from 'lucide-react';
import { CATEGORY_STYLE, NewsItem } from '../types';
import { timeAgo } from '../utils/format';

interface Props {
  item: NewsItem;
  onToggleFavorite: (id: string) => void;
  onMarkRead: (id: string, read: boolean) => void;
}

export default function NewsCard({ item, onToggleFavorite, onMarkRead }: Props) {
  const cat = CATEGORY_STYLE[item.category];
  const unread = !item.isRead;

  return (
    <article
      onClick={() => { if (unread) onMarkRead(item.id, true); }}
      className={`group relative flex flex-col gap-2 rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md dark:bg-slate-800 ${
        unread
          ? 'border-brand-200 dark:border-brand-500/30'
          : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      {unread && (
        <span className="absolute right-3 top-3 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
        </span>
      )}

      <div className="flex flex-wrap items-center gap-2 pr-6">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cat.bg}`}>
          {cat.text}
        </span>
        <span className="text-[11px] text-slate-400">{item.source}</span>
        <span className="text-[11px] text-slate-300 dark:text-slate-500">·</span>
        <span className="text-[11px] text-slate-400">{timeAgo(item.publishedAt)}</span>
      </div>

      <a
        href={item.url}
        target="_blank"
        rel="noreferrer noopener"
        onClick={(e) => e.stopPropagation()}
        className="line-clamp-2 text-[15px] font-semibold leading-snug text-slate-800 hover:text-brand-600 dark:text-slate-100 dark:hover:text-brand-300"
      >
        {item.title}
      </a>

      {item.summary && (
        <p className="line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{item.summary}</p>
      )}

      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.tags.slice(0, 4).map((t, i) => (
            <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-700 dark:text-slate-300">
              #{t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-1 flex items-center justify-between">
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer noopener"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
        >
          阅读原文 <ExternalLink className="h-3 w-3" />
        </a>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(item.id); }}
          title={item.isFavorite ? '取消收藏' : '收藏'}
          className={`rounded-full p-1.5 transition ${
            item.isFavorite
              ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10'
              : 'text-slate-300 hover:bg-slate-100 hover:text-amber-400 dark:hover:bg-slate-700'
          }`}
        >
          <Star className={`h-4 w-4 ${item.isFavorite ? 'fill-amber-400' : ''}`} />
        </button>
      </div>
    </article>
  );
}
