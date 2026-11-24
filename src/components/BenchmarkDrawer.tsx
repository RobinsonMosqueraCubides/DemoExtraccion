import { History, X } from 'lucide-react';
import type { BenchmarkSummary } from '../../shared/types';
import { formatMs, formatUsd } from '../utils/formatters';

interface BenchmarkDrawerProps {
  open: boolean;
  benchmarks: BenchmarkSummary[];
  onClose: () => void;
  onSelectRun: (runId: string) => void;
}

export function BenchmarkDrawer({
  open,
  benchmarks,
  onClose,
  onSelectRun,
}: BenchmarkDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs">
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <History className="h-5 w-5 text-amber-400" />
            <h2 className="text-base font-semibold text-white">
              Historial de Benchmarks (./outputs/)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {benchmarks.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">
              Aún no hay ejecuciones guardadas. Completa una corrida para comparar tiempos y tasas de cache hit.
            </p>
          ) : (
            benchmarks.map((b) => (
              <button
                key={b.runId}
                type="button"
                onClick={() => {
                  onSelectRun(b.runId);
                  onClose();
                }}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 p-3.5 text-left transition hover:border-emerald-500/40 hover:bg-slate-800/70"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-emerald-400">
                    {b.runId}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(b.createdAt).toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <div className="text-[11px] text-slate-500">Facturas</div>
                    <div className="font-mono font-semibold text-white">
                      {b.totalFiles} (C:{b.concurrency})
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Tiempo / Vel.</div>
                    <div className="font-mono font-semibold text-sky-300">
                      {formatMs(b.elapsedMs)} · {b.throughputPerSec}/s
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Cuadre</div>
                    <div className="font-mono font-semibold text-emerald-400">
                      {b.cuadraCount}/{b.totalFiles}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Caché / Costo</div>
                    <div className="font-mono text-amber-300">
                      {b.cacheHitRate}% · {formatUsd(b.estimatedCostUsd)}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
