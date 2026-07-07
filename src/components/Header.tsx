import { Bell, RefreshCw, Search, Settings, Sun, Moon, WifiOff } from 'lucide-react';
import { Stats } from '../types';

interface Props {
  search: string;
  onSearch: (v: string) => void;
  onFetchNow: () => void;
  fetching: boolean;
  statusText: string;
  onOpenSettings: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  stats: Stats;
  offline: boolean;
}

export default function Header({
  search, onSearch, onFetchNow, fetching, statusText, onOpenSettings,
  theme, onToggleTheme, stats, offline,
}: Props) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-bold text-white shadow">
          AI
        </div>
        <div className="hidden sm:block">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">AI News Agent</div>
          <div className="text-[11px] text-slate-400">智能资讯抓取</div>
        </div>
      </div>

      <div className="relative mx-2 flex-1 max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="搜索标题、摘要或关键词…"
          className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>

      <div className="flex items-center gap-1.5">
        {offline && (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-700">
            <WifiOff className="h-3.5 w-3.5" /> 离线
          </span>
        )}
        <span className="hidden items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300 md:flex">
          <Bell className="h-3.5 w-3.5" />
          {stats.unread} 未读
        </span>

        <button
          onClick={onFetchNow}
          disabled={fetching}
          className="flex items-center gap-1.5 rounded-full bg-brand-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${fetching ? 'animate-spin' : ''}`} />
          立即抓取
        </button>

        <button
          onClick={onToggleTheme}
          title="切换主题"
          className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <button
          onClick={onOpenSettings}
          title="设置"
          className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>

      {statusText && (
        <div className="absolute left-1/2 top-16 -translate-x-1/2 rounded-b-md bg-slate-800 px-3 py-1 text-xs text-slate-100 shadow">
          {statusText}
        </div>
      )}
    </header>
  );
}
