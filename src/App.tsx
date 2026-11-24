import { useEffect, useState } from 'react';
import type { InvoiceJobResult } from '../shared/types';
import { BenchmarkDrawer } from './components/BenchmarkDrawer';
import { ControlBar } from './components/ControlBar';
import { InvoiceTable } from './components/InvoiceTable';
import { KpiStrip } from './components/KpiStrip';
import { SplitViewDrawer } from './components/SplitViewDrawer';
import { useBenchmarkHistory } from './hooks/useBenchmarkHistory';
import { useExtractionRun } from './hooks/useExtractionRun';
import { useInvoices } from './hooks/useInvoices';

export default function App() {
  const invoices = useInvoices();
  const benchmarks = useBenchmarkHistory();
  const extraction = useExtractionRun(() => {
    void benchmarks.refresh();
  });

  const [concurrency, setConcurrency] = useState<number>(8);
  const [cacheWarmup, setCacheWarmup] = useState<boolean>(true);
  const [selectedJobFilename, setSelectedJobFilename] = useState<string | null>(null);
  const [benchmarksOpen, setBenchmarksOpen] = useState<boolean>(false);

  useEffect(() => {
    setConcurrency(invoices.defaultConcurrency);
  }, [invoices.defaultConcurrency]);

  const activeSelectedJob: InvoiceJobResult | null =
    extraction.run?.results.find((r) => r.filename === selectedJobFilename) ?? null;

  const handleStart = () => {
    setSelectedJobFilename(null);
    void extraction.startRun(
      Array.from(invoices.selectedFiles),
      concurrency,
      cacheWarmup
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <ControlBar
        folder={invoices.folder}
        model={invoices.model}
        files={invoices.files}
        selectedFiles={invoices.selectedFiles}
        concurrency={concurrency}
        maxConcurrency={invoices.maxConcurrency}
        cacheWarmup={cacheWarmup}
        isRunning={extraction.isRunning}
        isStarting={extraction.isStarting}
        loadingFiles={invoices.loading}
        hasApiKey={invoices.hasApiKey}
        runId={extraction.run?.runId ?? null}
        benchmarkCount={benchmarks.benchmarks.length}
        onRefreshFiles={() => void invoices.refresh()}
        onToggleFile={invoices.toggleFile}
        onSelectAll={invoices.selectAll}
        onSelectFirstN={invoices.selectFirstN}
        onClearSelection={invoices.clearSelection}
        onConcurrencyChange={setConcurrency}
        onCacheWarmupChange={setCacheWarmup}
        onStart={handleStart}
        onCancel={() => void extraction.cancelRun()}
        onOpenBenchmarks={() => setBenchmarksOpen(true)}
      />

      {(invoices.error || extraction.error) && (
        <div className="mx-auto mt-4 max-w-[1600px] px-4 sm:px-6">
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {invoices.error ?? extraction.error}
          </div>
        </div>
      )}

      <KpiStrip
        run={extraction.run}
        liveElapsedMs={extraction.liveElapsedMs}
        isRunning={extraction.isRunning}
      />

      <InvoiceTable
        run={extraction.run}
        selectedFilename={selectedJobFilename}
        onSelectRow={(job) => setSelectedJobFilename(job.filename)}
      />

      <SplitViewDrawer
        job={activeSelectedJob}
        onClose={() => setSelectedJobFilename(null)}
      />

      <BenchmarkDrawer
        open={benchmarksOpen}
        benchmarks={benchmarks.benchmarks}
        onClose={() => setBenchmarksOpen(false)}
        onSelectRun={(runId) => {
          setSelectedJobFilename(null);
          void extraction.loadHistoricalRun(runId);
        }}
      />
    </div>
  );
}
