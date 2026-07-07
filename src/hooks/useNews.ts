import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api';
import { NewsFilters, NewsItem, Stats } from '../types';

const CACHE_KEY = 'ainews:items:v1';
const CACHE_STATS = 'ainews:stats:v1';

export interface ToastMsg {
  id: number;
  text: string;
  detail?: string;
}

const emptyStats: Stats = {
  total: 0, unread: 0, favorites: 0, today: 0, lastFetchAt: null, isRunning: false,
};

export function useNews() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [filters, setFilters] = useState<NewsFilters>({
    category: 'all', search: '', favoritesOnly: false, unreadOnly: false,
  });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [statusText, setStatusText] = useState<string>('');
  const [translatingAll, setTranslatingAll] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const pushToast = useCallback((text: string, detail?: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, detail }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const cacheSave = useCallback((items: NewsItem[], stats: Stats) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(items.slice(0, 300)));
      localStorage.setItem(CACHE_STATS, JSON.stringify(stats));
    } catch { /* ignore quota */ }
  }, []);

  const load = useCallback(async (p = 1, opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setLoading(true);
    try {
      const res = await api.getNews({ ...filters, page: p, limit: 50 });
      setItems(res.items);
      setTotal(res.total);
      setHasMore(res.hasMore);
      setPage(res.page);
      setOffline(false);
      cacheSave(res.items, stats);
    } catch (e) {
      // 离线或后端不可用：尝试读取本地缓存
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        const cachedStats = localStorage.getItem(CACHE_STATS);
        if (cached) {
          setItems(JSON.parse(cached));
          setOffline(true);
          if (cachedStats) setStats(JSON.parse(cachedStats));
          pushToast('已离线，展示本地缓存', '连接后端后可同步最新资讯');
          return;
        }
      } catch { /* ignore */ }
      pushToast('无法连接后端服务', (e as Error).message);
    } finally {
      if (!opts.silent) setLoading(false);
    }
  }, [filters, cacheSave, pushToast]); // eslint-disable-line

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    setLoading(true);
    try {
      const res = await api.getNews({ ...filters, page: page + 1, limit: 50 });
      setItems((prev) => {
        const ids = new Set(prev.map((i) => i.id));
        return [...prev, ...res.items.filter((i) => !ids.has(i.id))];
      });
      setHasMore(res.hasMore);
      setPage(res.page);
    } finally {
      setLoading(false);
    }
  }, [filters, page, hasMore, loading]);

  const refresh = useCallback(() => load(1), [load]);

  // ============= SSE 实时推送 =============
  useEffect(() => {
    const es = new EventSource('/api/stream');
    esRef.current = es;
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'connected' || data.type === 'stats') {
          if (data.stats) { setStats(data.stats); cacheSave(items, data.stats); }
        } else if (data.type === 'news') {
          const incoming: NewsItem[] = data.items || [];
          if (incoming.length) {
            setItems((prev) => {
              const ids = new Set(prev.map((i) => i.id));
              const merged = [...incoming.filter((i) => !ids.has(i.id)), ...prev];
              cacheSave(merged, stats);
              return merged;
            });
            pushToast(`收到 ${incoming.length} 条新资讯`, '点击顶部刷新查看');
          }
        } else if (data.type === 'status') {
          setStatusText(data.message || '');
        }
      } catch { /* ignore */ }
    };
    es.onerror = () => { /* EventSource 会自动重连 */ };
    return () => { es.close(); esRef.current = null; };
  }, [pushToast, cacheSave]); // eslint-disable-line

  // 过滤器变化时重新加载
  useEffect(() => { load(1); }, [filters, load]); // eslint-disable-line

  const markRead = useCallback(async (id: string, read: boolean) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, isRead: read } : i)));
    try { await api.markRead(id, read); } catch { /* ignore */ }
  }, []);

  const toggleFavorite = useCallback(async (id: string) => {
    let newVal = false;
    setItems((prev) => prev.map((i) => {
      if (i.id === id) { newVal = !i.isFavorite; return { ...i, isFavorite: newVal }; }
      return i;
    }));
    try {
      const r = await api.toggleFavorite(id);
      newVal = r.isFavorite;
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, isFavorite: r.isFavorite } : i)));
    } catch { /* ignore */ }
    return newVal;
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((i) => ({ ...i, isRead: true })));
    try { await api.markAllRead(); await load(1, { silent: true }); } catch { /* ignore */ }
  }, [load]);

  const translateItem = useCallback(async (id: string): Promise<boolean> => {
    try {
      const r = await api.translateItem(id);
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...r.item } : i)));
      return true;
    } catch (e) {
      pushToast('翻译失败', (e as Error).message);
      return false;
    }
  }, [pushToast]);

  const translateAll = useCallback(async () => {
    setTranslatingAll(true);
    try {
      const r = await api.translateAll();
      pushToast(
        '翻译完成',
        `共 ${r.total} 条，成功 ${r.done}${r.failed ? `，失败 ${r.failed}` : ''}`
      );
      await load(1, { silent: true });
    } catch (e) {
      pushToast('翻译失败', (e as Error).message);
    } finally {
      setTranslatingAll(false);
    }
  }, [load, pushToast]);

  const fetchNow = useCallback(async () => {
    setFetching(true);
    setStatusText('正在抓取…');
    try {
      const r = await api.fetchNow();
      pushToast('抓取完成', `新增 ${r.added} 条（${r.mode}）`);
      await load(1);
      if (r.added > 0) {
        // 触发一次统计刷新
        try { setStats(await api.getStats()); } catch { /* ignore */ }
      }
    } catch (e) {
      pushToast('抓取失败', (e as Error).message);
    } finally {
      setFetching(false);
    }
  }, [load, pushToast]);

  return {
    items, stats, filters, setFilters, page, hasMore, total, loading, offline,
    fetching, translatingAll, toasts, statusText, setStatusText,
    load, loadMore, refresh, markRead, toggleFavorite, markAllRead, fetchNow,
    translateItem, translateAll, dismissToast,
  };
}
