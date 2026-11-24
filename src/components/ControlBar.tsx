import {
  FolderOpen,
  History,
  Play,
  RefreshCw,
  Square,
  Zap,
  CheckSquare,
} from 'lucide-react';
import { useState } from 'react';
import type { InvoiceFileInfo } from '../../shared/types';
import { formatBytes } from '../utils/formatters';
import { ExportMenu } from './ExportMenu';

interface ControlBarProps {
  folder: string;
  model: string;
  files: InvoiceFileInfo[];
  selectedFiles: Set<string>;
  concurrency: number;
  maxConcurrency: number;
  cacheWarmup: boolean;
  isRunning: boolean;
  isStarting: boolean;
  loadingFiles: boolean;
  hasApiKey: boolean;
  runId: string | null;
  benchmarkCount: number;
  onRefreshFiles: () => void;
  onToggleFile: (filename: string) => void;
  onSelectAll: () => void;
  onSelectFirstN: (n: number) => void;
  onClearSelection: () => void;
  onConcurrencyChange: (val: number) => void;
  onCacheWarmupChange: (val: boolean) => void;
  onStart: () => void;
  onCancel: () => void;
  onOpenBenchmarks: () => void;
}

export function ControlBar({
  folder,
  model,
  files,
  selectedFiles,
  concurrency,
  maxConcurrency,
  cacheWarmup,
  isRunning,
  isStarting,
  loadingFiles,
  hasApiKey,
  runId,
  benchmarkCount,
  onRefreshFiles,
  onToggleFile,
  onSelectAll,
  onSelectFirstN,
  onClearSelection,
  onConcurrencyChange,
  onCacheWarmupChange,
  onStart,
  onCancel,
  onOpenBenchmarks,
}: ControlBarProps) {
  const [showFilePicker, setShowFilePicker] = useState(false);

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur">
      <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-semibold tracking-tight text-white">
                  Extracción Masiva de Facturas — Gases del Caribe
                </h1>
                <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-mono text-sky-300 ring-1 ring-slate-700">
                  {model} · adaptive/medium
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1 font-mono">
                  <FolderOpen className="h-3.5 w-3.5 text-amber-400" />
                  {folder}
                </span>
                <span>•</span>
                <span>
                  <strong className="text-slate-200">{files.length}</strong> PDFs detectados
                </span>
                <span>•</span>
                <span>
                  <strong className="text-emerald-400">{selectedFiles.size}</strong> seleccionados
                </span>
                {!hasApiKey && (
                  <span className="rounded bg-rose-500/20 px-2 py-0.5 font-medium text-rose-300">
                    Falta ANTHROPIC_API_KEY en .env
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onRefreshFiles}
              disabled={loadingFiles || isRunning}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-700 disabled:opacity-40"
            >
              <RefreshCw className={`h-4 w-4 ${loadingFiles ? 'animate-spin' : ''}`} />
              Refrescar carpeta
            </button>

            <button
              type="button"
              onClick={() => setShowFilePicker((v) => !v)}
              disabled={files.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-700 disabled:opacity-40"
            >
              <CheckSquare className="h-4 w-4 text-sky-400" />
              Seleccionar ({selectedFiles.size}/{files.length})
            </button>

            <button
              type="button"
              onClick={onOpenBenchmarks}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-700"
            >
              <History className="h-4 w-4 text-amber-400" />
              Benchmarks ({benchmarkCount})
            </button>

            <ExportMenu runId={runId} disabled={isRunning} />

            {isRunning ? (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-950/50 transition hover:bg-rose-500"
              >
                <Square className="h-4 w-4 fill-current" />
                Cancelar
              </button>
            ) : (
              <button
                type="button"
                onClick={onStart}
                disabled={selectedFiles.size === 0 || isStarting || !hasApiKey}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-950/50 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Play className="h-4 w-4 fill-current" />
                {isStarting ? 'Iniciando...' : `Procesar ${selectedFiles.size} facturas`}
              </button>
            )}
          </div>
        </div>

        {/* Parámetros de velocidad */}
        <div className="mt-3 flex flex-wrap items-center gap-6 border-t border-slate-800/80 pt-3 text-xs text-slate-300">
          <div className="flex items-center gap-3">
            <label htmlFor="concurrency-slider" className="font-medium text-slate-400">
              Concurrencia paralela:
            </label>
            <input
              id="concurrency-slider"
              type="range"
              min={1}
              max={maxConcurrency}
              value={concurrency}
              disabled={isRunning}
              onChange={(e) => onConcurrencyChange(Number(e.target.value))}
              className="h-1.5 w-32 cursor-pointer accent-emerald-500 disabled:opacity-50"
            />
            <span className="w-8 rounded bg-slate-800 px-1.5 py-0.5 text-center font-mono font-semibold text-emerald-400">
              {concurrency}
            </span>
          </div>

          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={cacheWarmup}
              disabled={isRunning}
              onChange={(e) => onCacheWarmupChange(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-emerald-500"
            />
            <span className="text-slate-300">
              Warm-up de caché (factura #1 primero para maximizar cache hit en 2..N)
            </span>
          </label>

          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-slate-500">Selección rápida:</span>
            {[5, 10, 20].map((n) => (
              <button
                key={n}
                type="button"
                disabled={isRunning || files.length === 0}
                onClick={() => onSelectFirstN(n)}
                className="rounded border border-slate-700 bg-slate-800/70 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-40"
              >
                Primeras {n}
              </button>
            ))}
            <button
              type="button"
              disabled={isRunning || files.length === 0}
              onClick={onSelectAll}
              className="rounded border border-slate-700 bg-slate-800/70 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            >
              Todas
            </button>
          </div>
        </div>

        {/* Selector expandible de archivos */}
        {showFilePicker && (
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/90 p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300">
                Archivos PDF en <code className="text-amber-300">./facturas/</code>
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onSelectAll}
                  className="text-emerald-400 hover:underline"
                >
                  Seleccionar todos
                </button>
                <button
                  type="button"
                  onClick={onClearSelection}
                  className="text-slate-400 hover:underline"
                >
                  Limpiar
                </button>
              </div>
            </div>
            <div className="grid max-h-48 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {files.map((f) => {
                const checked = selectedFiles.has(f.filename);
                return (
                  <label
                    key={f.filename}
                    className={`flex cursor-pointer items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs transition ${
                      checked
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-slate-100'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isRunning}
                        onChange={() => onToggleFile(f.filename)}
                        className="accent-emerald-500"
                      />
                      <span className="truncate font-mono">{f.filename}</span>
                    </span>
                    <span className="ml-2 shrink-0 text-[11px] text-slate-500">
                      {formatBytes(f.sizeBytes)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
