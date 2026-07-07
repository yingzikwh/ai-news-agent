import { useState } from 'react';
import { Plus, Trash2, X, KeyRound, Radio, Clock, Database } from 'lucide-react';
import { AgentMode, AppConfig, CATEGORIES, Category, Source } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  config: AppConfig | null;
  sources: Source[];
  onSetRunning: (run: boolean) => void;
  onSetMode: (mode: AgentMode) => void;
  onSetInterval: (min: number) => void;
  onUpdateConfig: (patch: Partial<AppConfig> & { apiKey?: string }) => Promise<any>;
  onAddSource: (s: Omit<Source, 'id'>) => Promise<any>;
  onUpdateSource: (id: string, patch: Partial<Source>) => Promise<any>;
  onDeleteSource: (id: string) => Promise<any>;
}

const MODE_OPTIONS: { value: AgentMode; label: string; desc: string }[] = [
  { value: 'hybrid', label: '混合模式', desc: '优先 Agent 智能抓取，失败自动回退直连 RSS（推荐）' },
  { value: 'agent', label: '仅 Agent', desc: '仅使用 CodeBuddy Agent SDK 抓取（需配置 API Key）' },
  { value: 'direct', label: '仅直连', desc: '直接抓取 RSS/Atom 源，无需 API Key' },
];

const INTERVAL_PRESETS = [5, 10, 15, 30, 60, 120, 360];

export default function SettingsDialog({
  open, onClose, config, sources, onSetRunning, onSetMode, onSetInterval,
  onUpdateConfig, onAddSource, onUpdateSource, onDeleteSource,
}: Props) {
  const [apiKey, setApiKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newType, setNewType] = useState<'rss' | 'web'>('rss');
  const [newHint, setNewHint] = useState<Category | ''>('');

  if (!open) return null;

  const saveApiKey = async () => {
    if (!apiKey.trim()) return;
    setSavingKey(true);
    try { await onUpdateConfig({ apiKey: apiKey.trim() }); setApiKey(''); }
    finally { setSavingKey(false); }
  };

  const submitNew = async () => {
    if (!newName.trim() || !newUrl.trim()) return;
    await onAddSource({
      name: newName.trim(), url: newUrl.trim(), type: newType, enabled: true,
      categoryHint: newHint || undefined,
    });
    setNewName(''); setNewUrl(''); setNewType('rss'); setNewHint('');
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">设置</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
          {/* 抓取设置 */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Radio className="h-4 w-4 text-brand-500" /> 抓取设置
            </h3>

            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200">自动定时抓取</div>
                  <div className="text-xs text-slate-400">开启后按设定间隔自动抓取最新资讯</div>
                </div>
                <button
                  onClick={() => onSetRunning(!config?.isRunning)}
                  className={`relative h-6 w-11 rounded-full transition ${config?.isRunning ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${config?.isRunning ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>

              <div className="mt-3">
                <div className="mb-1.5 text-xs font-medium text-slate-500">抓取模式</div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {MODE_OPTIONS.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => onSetMode(m.value)}
                      className={`rounded-lg border p-2 text-left transition ${
                        config?.agentMode === m.value
                          ? 'border-brand-400 bg-brand-50 dark:bg-brand-500/10'
                          : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{m.label}</div>
                      <div className="mt-0.5 text-[11px] leading-tight text-slate-400">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Clock className="h-3.5 w-3.5" /> 抓取间隔（分钟）
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {INTERVAL_PRESETS.map((p) => (
                    <button
                      key={p}
                      onClick={() => onSetInterval(p)}
                      className={`rounded-full px-3 py-1 text-xs transition ${
                        config?.intervalMinutes === p
                          ? 'bg-brand-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {p >= 60 ? `${p / 60} 小时` : `${p} 分`}
                    </button>
                  ))}
                </div>
                <input
                  type="number" min={1} max={1440}
                  value={config?.intervalMinutes ?? 15}
                  onChange={(e) => onSetInterval(Number(e.target.value) || 15)}
                  className="mt-2 w-28 rounded-lg border border-slate-200 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-700"
                />
              </div>
            </div>
          </section>

          {/* API Key */}
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <KeyRound className="h-4 w-4 text-brand-500" /> CodeBuddy API Key
            </h3>
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <p className="mb-2 text-xs text-slate-400">
                配置后 Agent 模式将使用 CodeBuddy 大模型智能抓取并归类。未配置时自动回退直连 RSS，应用仍可正常运行。
                当前状态：{config?.hasApiKey ? <span className="text-emerald-500">已配置（{config.apiKeyMasked}）</span> : <span className="text-amber-500">未配置</span>}
              </p>
              <div className="flex gap-2">
                <input
                  type="password" value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="粘贴 CODEBUDDY_API_KEY"
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700"
                />
                <button
                  onClick={saveApiKey} disabled={savingKey || !apiKey.trim()}
                  className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  保存
                </button>
              </div>
            </div>
          </section>

          {/* 数据源 */}
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Database className="h-4 w-4 text-brand-500" /> 数据源（{sources.length}）
            </h3>
            <div className="space-y-2">
              {sources.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                  <input
                    type="checkbox" checked={s.enabled}
                    onChange={(e) => onUpdateSource(s.id, { enabled: e.target.checked })}
                    className="h-4 w-4 accent-brand-500"
                  />
                  <input
                    value={s.name}
                    onChange={(e) => onUpdateSource(s.id, { name: e.target.value })}
                    className="w-32 rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-700"
                  />
                  <input
                    value={s.url}
                    onChange={(e) => onUpdateSource(s.id, { url: e.target.value })}
                    className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-700"
                  />
                  <select
                    value={s.type}
                    onChange={(e) => onUpdateSource(s.id, { type: e.target.value as 'rss' | 'web' })}
                    className="rounded border border-slate-200 px-1 py-1 text-xs dark:border-slate-600 dark:bg-slate-700"
                  >
                    <option value="rss">RSS</option>
                    <option value="web">Web</option>
                  </select>
                  <select
                    value={s.categoryHint || ''}
                    onChange={(e) => onUpdateSource(s.id, { categoryHint: (e.target.value || undefined) as Category | undefined })}
                    className="rounded border border-slate-200 px-1 py-1 text-xs dark:border-slate-600 dark:bg-slate-700"
                  >
                    <option value="">自动</option>
                    {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                  <button
                    onClick={() => onDeleteSource(s.id)}
                    className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
              <input
                value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="名称" className="w-28 rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-700"
              />
              <input
                value={newUrl} onChange={(e) => setNewUrl(e.target.value)}
                placeholder="RSS / 网站链接" className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-700"
              />
              <select value={newType} onChange={(e) => setNewType(e.target.value as 'rss' | 'web')}
                className="rounded border border-slate-200 px-1 py-1 text-xs dark:border-slate-600 dark:bg-slate-700">
                <option value="rss">RSS</option><option value="web">Web</option>
              </select>
              <select value={newHint} onChange={(e) => setNewHint(e.target.value as Category | '')}
                className="rounded border border-slate-200 px-1 py-1 text-xs dark:border-slate-600 dark:bg-slate-700">
                <option value="">自动</option>
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <button
                onClick={submitNew}
                className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600"
              >
                <Plus className="h-3.5 w-3.5" /> 添加
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
