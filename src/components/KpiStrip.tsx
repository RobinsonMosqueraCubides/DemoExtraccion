import {
  Activity,
  CheckCircle2,
  Clock,
  Coins,
  Database,
  Gauge,
} from 'lucide-react';
import type { ExtractionRunRecord } from '../../shared/types';
import { formatCop, formatMs, formatTokens, formatUsd } from '../utils/formatters';

interface KpiStripProps {
  run: ExtractionRunRecord | null;
  liveElapsedMs: number;
  isRunning: boolean;
}

export function KpiStrip({ run, liveElapsedMs, isRunning }: KpiStripProps) {
  const m = run?.metrics;
  const total = m?.totalFiles ?? 0;
  const finished = (m?.completedCount ?? 0) + (m?.failedCount ?? 0);
  const progressPct = total > 0 ? Math.round((finished / total) * 100) : 0;

  const validChecked = (m?.cuadraCount ?? 0) + (m?.descuadreCount ?? 0);
  const cuadrePct =
    validChecked > 0 ? Math.round(((m?.cuadraCount ?? 0) / validChecked) * 100) : 0;

  const displayElapsedMs = isRunning ? liveElapsedMs : (m?.elapsedMs ?? 0);

  return (
    <section className="mx-auto max-w-[1600px] px-4 pt-4 sm:px-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {/* Cronómetro Total */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Cronómetro Total</span>
            <Clock className={`h-4 w-4 ${isRunning ? 'animate-pulse text-emerald-400' : 'text-slate-500'}`} />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-white">
            {(displayElapsedMs / 1000).toFixed(2)}s
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {isRunning ? 'Ejecución en curso...' : run ? `Estado: ${run.status}` : 'Listo para iniciar'}
          </div>
        </div>

        {/* Progreso y Throughput */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Progreso</span>
            <Gauge className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold text-white">
              {finished}/{total}
            </span>
            <span className="font-mono text-xs text-sky-400">
              {m?.throughputPerSec ?? 0} fact/s
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-sky-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Latencia Promedio / P95 */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Latencia / Factura</span>
            <Activity className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-white">
            {formatMs(m?.avgLatencyMs)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            p95: <span className="font-mono text-slate-200">{formatMs(m?.p95LatencyMs)}</span>
          </div>
        </div>

        {/* Cuadre Contable */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Exactitud Contable</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-emerald-400">
              {cuadrePct}%
            </span>
            <span className="text-xs text-slate-400">
              ({m?.cuadraCount ?? 0} cuadran)
            </span>
          </div>
          <div className="mt-1 flex gap-2 text-[11px]">
            <span className="text-amber-400">{m?.descuadreCount ?? 0} desc.</span>
            <span className="text-slate-400">{m?.noValidaCount ?? 0} no vál.</span>
            <span className="text-rose-400">{m?.errorCount ?? 0} err.</span>
          </div>
        </div>

        {/* Prompt Caching */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Cache Hit & Tokens</span>
            <Database className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-amber-300">
            {m?.cacheHitRate ?? 0}%
          </div>
          <div className="mt-1 truncate text-[11px] text-slate-400">
            In: {formatTokens(m?.totalInputTokens ?? 0)} · Out: {formatTokens(m?.totalOutputTokens ?? 0)}
          </div>
        </div>

        {/* Costo & Total Facturado */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Costo API / Total COP</span>
            <Coins className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-white">
            {formatUsd(m?.estimatedCostUsd ?? 0)}
          </div>
          <div className="mt-1 truncate text-[11px] text-emerald-400 font-mono">
            {formatCop(m?.grandTotalCop ?? 0)}
          </div>
        </div>
      </div>
    </section>
  );
}
