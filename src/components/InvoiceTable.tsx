import {
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  Loader2,
  Search,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  ExtractionRunRecord,
  InvoiceJobResult,
  ValidationClassification,
} from '../../shared/types';
import { formatCop, formatMs } from '../utils/formatters';

interface InvoiceTableProps {
  run: ExtractionRunRecord | null;
  selectedFilename: string | null;
  onSelectRow: (result: InvoiceJobResult) => void;
}

type FilterOption = 'ALL' | ValidationClassification;

function StatusBadge({ job }: { job: InvoiceJobResult }) {
  if (job.status === 'queued') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
        En cola
      </span>
    );
  }
  if (job.status === 'processing' || job.status === 'retrying') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-medium text-sky-300 ring-1 ring-sky-500/30">
        <Loader2 className="h-3 w-3 animate-spin" />
        {job.status === 'retrying' ? `Reintento #${job.attempts}` : 'Extrayendo'}
      </span>
    );
  }
  if (job.status === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
        Cancelado
      </span>
    );
  }

  const cls = job.audit?.classification ?? 'ERROR';
  if (cls === 'CUADRA') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/30">
        <CheckCircle2 className="h-3 w-3" />
        Cuadra
      </span>
    );
  }
  if (cls === 'DESCUADRE') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-amber-500/30">
        <AlertTriangle className="h-3 w-3" />
        Descuadre
      </span>
    );
  }
  if (cls === 'NO_VALIDA') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-700/60 px-2.5 py-0.5 text-xs font-medium text-slate-300 ring-1 ring-slate-600">
        <FileWarning className="h-3 w-3" />
        No válida
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-medium text-rose-300 ring-1 ring-rose-500/30">
      <XCircle className="h-3 w-3" />
      Error
    </span>
  );
}

export function InvoiceTable({
  run,
  selectedFilename,
  onSelectRow,
}: InvoiceTableProps) {
  const [filter, setFilter] = useState<FilterOption>('ALL');
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    if (!run) return [];
    const q = search.trim().toLowerCase();
    return run.results.filter((r) => {
      if (filter !== 'ALL') {
        if (r.status !== 'completed' && r.status !== 'failed') return false;
        if ((r.audit?.classification ?? 'ERROR') !== filter) return false;
      }
      if (!q) return true;
      return (
        r.filename.toLowerCase().includes(q) ||
        (r.data?.identificacion.numero_factura ?? '').toLowerCase().includes(q) ||
        (r.data?.identificacion.numero_contrato ?? '').toLowerCase().includes(q) ||
        (r.data?.identificacion.titular ?? '').toLowerCase().includes(q)
      );
    });
  }, [run, filter, search]);

  if (!run) {
    return (
      <section className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center">
          <p className="text-base font-medium text-slate-300">
            Coloca tus facturas PDF en <code className="text-amber-300">./facturas/</code> y presiona{' '}
            <strong className="text-emerald-400">Procesar facturas</strong> para iniciar el benchmark en vivo.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Cada fila se actualizará en tiempo real vía Server-Sent Events y podrás hacer clic en cualquiera para abrir el Split-View (PDF vs JSON / Cuentas JDE).
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        {/* Toolbar de tabla */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['ALL', 'Todas'],
                ['CUADRA', 'Cuadran'],
                ['DESCUADRE', 'Descuadran'],
                ['NO_VALIDA', 'No válidas'],
                ['ERROR', 'Errores'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  filter === key
                    ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar archivo, factura, contrato, titular..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 py-1.5 pr-3 pl-9 text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Estado</th>
                <th className="px-3 py-3">Archivo PDF</th>
                <th className="px-3 py-3 text-right">Tiempo</th>
                <th className="px-3 py-3">N° Factura / Contrato</th>
                <th className="px-3 py-3">Titular</th>
                <th className="px-3 py-3 text-right">513555.35</th>
                <th className="px-3 py-3 text-right">519595.05</th>
                <th className="px-3 py-3 text-right">519595.30</th>
                <th className="px-4 py-3 text-right">Total a Pagar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {rows.map((job) => {
                const isSelected = selectedFilename === job.filename;
                const d = job.data;
                return (
                  <tr
                    key={job.filename}
                    onClick={() => onSelectRow(job)}
                    className={`cursor-pointer transition ${
                      isSelected
                        ? 'bg-emerald-500/10'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <StatusBadge job={job} />
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-200">
                      {job.filename}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-300 whitespace-nowrap">
                      {formatMs(job.latencyMs)}
                      {job.attempts > 1 && (
                        <span className="ml-1 text-[10px] text-amber-400">
                          ({job.attempts}x)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-mono text-slate-200">
                        {d?.identificacion.numero_factura ?? '—'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Cto: {d?.identificacion.numero_contrato ?? '—'}
                      </div>
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2.5 text-slate-300">
                      {d?.identificacion.titular ?? (job.error ? job.error : '—')}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-200">
                      {d ? formatCop(d.totales_por_cuenta['513555.35']) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-200">
                      {d ? formatCop(d.totales_por_cuenta['519595.05']) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-200">
                      {d ? formatCop(d.totales_por_cuenta['519595.30']) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-white">
                      {d ? formatCop(d.valor_total) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-slate-700 bg-slate-950/90 font-mono text-xs font-semibold text-white">
              <tr>
                <td colSpan={5} className="px-4 py-3 text-right text-slate-400">
                  TOTALES CONSOLIDADOS (FACTURAS VÁLIDAS):
                </td>
                <td className="px-3 py-3 text-right text-sky-300">
                  {formatCop(run.metrics.totalsByAccount['513555.35'])}
                </td>
                <td className="px-3 py-3 text-right text-sky-300">
                  {formatCop(run.metrics.totalsByAccount['519595.05'])}
                </td>
                <td className="px-3 py-3 text-right text-sky-300">
                  {formatCop(run.metrics.totalsByAccount['519595.30'])}
                </td>
                <td className="px-4 py-3 text-right text-emerald-400">
                  {formatCop(run.metrics.grandTotalCop)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}
