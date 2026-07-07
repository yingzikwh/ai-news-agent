import { CheckCircle2, X } from 'lucide-react';
import { ToastMsg } from '../hooks/useNews';

interface Props {
  toasts: ToastMsg[];
  onDismiss: (id: number) => void;
}

export default function Toast({ toasts, onDismiss }: Props) {
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex w-72 items-start gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-lg dark:border-slate-700 dark:bg-slate-800"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
          <div className="flex-1">
            <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{t.text}</div>
            {t.detail && <div className="mt-0.5 text-xs text-slate-400">{t.detail}</div>}
          </div>
          <button
            onClick={() => onDismiss(t.id)}
            className="rounded p-0.5 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500 dark:hover:bg-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
