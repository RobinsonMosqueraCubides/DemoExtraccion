import { Check, Copy, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import type { InvoiceJobResult } from '../../shared/types';
import { formatCop, formatMs, formatUsd } from '../utils/formatters';

interface SplitViewDrawerProps {
  job: InvoiceJobResult | null;
  onClose: () => void;
}

export function SplitViewDrawer({ job, onClose }: SplitViewDrawerProps) {
  const [tab, setTab] = useState<'accounting' | 'json'>('accounting');
  const [copied, setCopied] = useState(false);

  if (!job) return null;

  const pdfUrl = `/api/invoices/${encodeURIComponent(job.filename)}/pdf`;
  const jsonString = job.data
    ? JSON.stringify(job.data, null, 2)
    : job.rawText ?? '';

  const copyJson = async () => {
    if (!jsonString) return;
    await navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs">
      <div className="flex h-full w-full max-w-[1360px] flex-col border-l border-slate-800 bg-slate-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <h2 className="font-mono text-sm font-semibold text-white">
              {job.filename}
            </h2>
            <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-300">
              {formatMs(job.latencyMs)} · {job.attempts} intento(s) · {formatUsd(job.estimatedCostUsd)}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Split body */}
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
          {/* Izquierda: PDF Original */}
          <div className="flex flex-col border-b border-slate-800 bg-slate-900/50 lg:border-r lg:border-b-0">
            <div className="border-b border-slate-800 px-4 py-2 text-xs font-medium text-slate-400">
              Documento PDF Original
            </div>
            <iframe
              src={pdfUrl}
              title={job.filename}
              className="h-full min-h-[380px] w-full flex-1 bg-white"
            />
          </div>

          {/* Derecha: Datos / JSON */}
          <div className="flex min-h-0 flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTab('accounting')}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${
                    tab === 'accounting'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Vista Contable JDE
                </button>
                <button
                  type="button"
                  onClick={() => setTab('json')}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${
                    tab === 'json'
                      ? 'bg-sky-500/20 text-sky-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  JSON Crudo
                </button>
              </div>
              <button
                type="button"
                onClick={copyJson}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-700"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copiado' : 'Copiar JSON'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 text-xs">
              {tab === 'json' ? (
                <pre className="rounded-xl border border-slate-800 bg-slate-900 p-4 font-mono text-xs leading-relaxed text-sky-200 overflow-x-auto">
                  {jsonString || 'Sin salida JSON disponible.'}
                </pre>
              ) : !job.data ? (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200">
                  {job.error ?? 'Aún no hay datos extraídos para este documento.'}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Banner Auditoría */}
                  {job.audit && (
                    <div
                      className={`rounded-xl border p-3 ${
                        job.audit.classification === 'CUADRA'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                          : job.audit.classification === 'NO_VALIDA'
                            ? 'border-slate-700 bg-slate-900 text-slate-300'
                            : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-semibold">
                        {job.audit.classification === 'CUADRA' ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-400" />
                        )}
                        Estado de Auditoría Local: {job.audit.classification}
                      </div>
                      {job.audit.discrepancies.length > 0 && (
                        <ul className="mt-1.5 list-disc pl-5 text-[11px] space-y-0.5">
                          {job.audit.discrepancies.map((d, idx) => (
                            <li key={idx}>{d}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Identificación y Fechas */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-1">
                      <div className="text-[11px] font-semibold uppercase text-slate-400">
                        Identificación
                      </div>
                      <div>Factura: <strong className="font-mono text-white">{job.data.identificacion.numero_factura ?? '—'}</strong></div>
                      <div>Contrato: <strong className="font-mono text-white">{job.data.identificacion.numero_contrato ?? '—'}</strong></div>
                      <div>Cupón: <span className="font-mono">{job.data.identificacion.numero_cupon ?? '—'}</span></div>
                      <div>Medidor: <span className="font-mono">{job.data.identificacion.numero_medidor ?? '—'}</span></div>
                      <div>Titular: <span className="text-white">{job.data.identificacion.titular ?? '—'}</span></div>
                      <div>Dirección: <span>{job.data.identificacion.direccion_predio ?? '—'}</span></div>
                      <div>Apto: <span>{job.data.identificacion.apto ?? '—'}</span> · Estrato: <span>{job.data.identificacion.estrato ?? '—'}</span></div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-1">
                      <div className="text-[11px] font-semibold uppercase text-slate-400">
                        Fechas y Resumen
                      </div>
                      <div>Periodo actual: <span>{job.data.fechas.periodo_facturacion_actual ?? '—'}</span></div>
                      <div>Emisión: <span className="font-mono">{job.data.fechas.fecha_emision ?? '—'}</span></div>
                      <div>1er Vencimiento: <span className="font-mono">{job.data.fechas.primer_vencimiento ?? '—'}</span></div>
                      <div>2do Vencimiento: <span className="font-mono">{job.data.fechas.segundo_vencimiento ?? '—'}</span></div>
                      <div>Consumo actual / ant.: <span className="font-mono">{job.data.consumo_actual ?? '—'} / {job.data.consumo_anterior ?? '—'} m³</span></div>
                      <div>Saldo anterior: <span className="font-mono">{formatCop(job.data.saldo_anterior)}</span></div>
                      <div>Cargos del mes: <span className="font-mono">{formatCop(job.data.cargos_del_mes)}</span></div>
                      <div>Valor Total: <strong className="font-mono text-emerald-400">{formatCop(job.data.valor_total)}</strong></div>
                    </div>
                  </div>

                  {/* Totales por cuenta JDE */}
                  <div className="grid grid-cols-3 gap-2">
                    {(['513555.35', '519595.05', '519595.30'] as const).map((acct) => (
                      <div
                        key={acct}
                        className="rounded-xl border border-slate-800 bg-slate-900 p-3"
                      >
                        <div className="font-mono text-[11px] text-sky-400">
                          Cuenta {acct}
                        </div>
                        <div className="mt-1 font-mono text-base font-bold text-white">
                          {formatCop(job.data!.totales_por_cuenta[acct])}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Conceptos */}
                  <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
                    <div className="border-b border-slate-800 px-3 py-2 text-[11px] font-semibold uppercase text-slate-400">
                      Conceptos Extraídos ({job.data.conceptos_extraidos.length})
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950/60 text-[11px] text-slate-400">
                        <tr>
                          <th className="px-3 py-2">Concepto</th>
                          <th className="px-3 py-2">Cuenta JDE</th>
                          <th className="px-3 py-2 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {job.data.conceptos_extraidos.map((c, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-1.5 text-slate-200">
                              {c.nombre_en_documento}
                            </td>
                            <td className="px-3 py-1.5 font-mono text-sky-300">
                              {c.cuenta_asignada}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono text-white">
                              {formatCop(c.valor)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Observaciones */}
                  {job.data.observaciones.length > 0 && (
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                      <div className="text-[11px] font-semibold uppercase text-slate-400">
                        Observaciones
                      </div>
                      <ul className="mt-1 list-disc pl-4 text-slate-300 space-y-0.5">
                        {job.data.observaciones.map((obs, idx) => (
                          <li key={idx}>{obs}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
