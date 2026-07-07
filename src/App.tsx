import { useEffect, useState } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import NewsFeed from './components/NewsFeed';
import SettingsDialog from './components/SettingsDialog';
import Toast from './components/Toast';
import { useNews } from './hooks/useNews';
import { useConfig } from './hooks/useConfig';

type Theme = 'light' | 'dark';

export default function App() {
  const news = useNews();
  const cfg = useConfig();
  const [theme, setTheme] = useState<Theme>(
    (localStorage.getItem('ainews:theme') as Theme) || 'light'
  );
  const [searchInput, setSearchInput] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 主题
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
    localStorage.setItem('ainews:theme', theme);
  }, [theme]);

  // 搜索防抖
  useEffect(() => {
    const t = setTimeout(() => {
      news.setFilters((f) => ({ ...f, search: searchInput }));
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]); // eslint-disable-line

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100">
      <Header
        search={searchInput}
        onSearch={setSearchInput}
        onFetchNow={news.fetchNow}
        fetching={news.fetching}
        statusText={news.statusText}
        onOpenSettings={() => setSettingsOpen(true)}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        stats={news.stats}
        offline={news.offline}
      />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          filters={news.filters}
          setFilters={news.setFilters}
          items={news.items}
          stats={news.stats}
        />
        <main className="flex min-w-0 flex-1 flex-col">
          <NewsFeed
            items={news.items}
            loading={news.loading}
            hasMore={news.hasMore}
            total={news.total}
            offline={news.offline}
            onLoadMore={news.loadMore}
            onToggleFavorite={news.toggleFavorite}
            onMarkRead={news.markRead}
          />
        </main>
      </div>

      <Toast toasts={news.toasts} onDismiss={news.dismissToast} />

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        config={cfg.config}
        sources={cfg.sources}
        onSetRunning={cfg.setRunning}
        onSetMode={cfg.setMode}
        onSetInterval={cfg.setIntervalMin}
        onUpdateConfig={cfg.updateConfig}
        onAddSource={cfg.addSource}
        onUpdateSource={cfg.updateSource}
        onDeleteSource={cfg.deleteSource}
      />
    </div>
  );
}
