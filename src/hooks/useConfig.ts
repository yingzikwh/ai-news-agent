import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { AgentMode, AppConfig, Source } from '../types';

export function useConfig() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([api.getConfig(), api.getSources()]);
      setConfig(c);
      setSources(s.sources);
    } catch (e) {
      console.error('加载配置失败', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const updateConfig = useCallback(async (patch: Partial<AppConfig> & { apiKey?: string }) => {
    const r = await api.updateConfig(patch);
    setConfig(r.config);
    return r;
  }, []);

  const addSource = useCallback(async (s: Omit<Source, 'id'>) => {
    const r = await api.addSource(s);
    setSources((prev) => [...prev, r.source]);
    return r.source;
  }, []);

  const updateSource = useCallback(async (id: string, patch: Partial<Source>) => {
    const r = await api.updateSource(id, patch);
    setSources((prev) => prev.map((x) => (x.id === id ? r.source : x)));
    return r.source;
  }, []);

  const deleteSource = useCallback(async (id: string) => {
    await api.deleteSource(id);
    setSources((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const setRunning = useCallback(async (run: boolean) => {
    const r = await api.updateConfig({ isRunning: run });
    setConfig(r.config);
  }, []);

  const setMode = useCallback(async (mode: AgentMode) => {
    const r = await api.updateConfig({ agentMode: mode });
    setConfig(r.config);
  }, []);

  const setIntervalMin = useCallback(async (intervalMinutes: number) => {
    const r = await api.updateConfig({ intervalMinutes });
    setConfig(r.config);
  }, []);

  return {
    config, sources, loading, reload,
    updateConfig, addSource, updateSource, deleteSource, setRunning, setMode, setIntervalMin,
  };
}
