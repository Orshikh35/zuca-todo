"use client";

import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { useStore } from "@/lib/data/store";

export function Toaster() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-pop pointer-events-auto flex min-w-64 items-center gap-2.5 rounded-xl bg-neutral-900 ring-1 ring-white/10 px-3.5 py-2.5 text-sm text-white shadow-lift"
        >
          {t.tone === "ok" ? <CheckCircle2 size={16} className="text-emerald-400" /> : <AlertCircle size={16} className="text-red-400" />}
          <span className="flex-1">{t.text}</span>
          {t.action && (
            <button
              className="cursor-pointer rounded-md px-2 py-0.5 text-xs font-semibold text-brand-200 hover:bg-white/10"
              onClick={() => {
                t.action!.run();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button onClick={() => dismissToast(t.id)} className="cursor-pointer text-zinc-400 hover:text-white" aria-label="Хаах">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
