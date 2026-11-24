import { Download, FileSpreadsheet, FileJson, FileText } from 'lucide-react';
import { useState } from 'react';

interface ExportMenuProps {
  runId: string | null;
  disabled?: boolean;
}

export function ExportMenu({ runId, disabled }: ExportMenuProps) {
  const [open, setOpen] = useState(false);

  const download = (format: string) => {
    if (!runId) return;
    window.open(`/api/runs/${runId}/export?format=${format}`, '_blank');
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        disabled={!runId || disabled}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Download className="h-4 w-4 text-emerald-400" />
        Exportar
      </button>

      {open && runId && (
        <div
          className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-slate-700 bg-slate-900 p-1.5 shadow-2xl"
          onMouseLeave={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => download('xlsx')}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            <div>
              <div className="font-medium">Excel JDE (.xlsx)</div>
              <div className="text-xs text-slate-400">Resumen + Detalle de conceptos</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => download('csv-summary')}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
          >
            <FileText className="h-4 w-4 text-sky-400" />
            <div>
              <div className="font-medium">CSV Resumen Facturas</div>
              <div className="text-xs text-slate-400">1 fila por factura + 3 cuentas JDE</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => download('csv-detail')}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
          >
            <FileText className="h-4 w-4 text-indigo-400" />
            <div>
              <div className="font-medium">CSV Detalle Conceptos</div>
              <div className="text-xs text-slate-400">1 fila por renglón para asientos</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => download('json')}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
          >
            <FileJson className="h-4 w-4 text-amber-400" />
            <div>
              <div className="font-medium">JSON Consolidado</div>
              <div className="text-xs text-slate-400">Métricas + esquema completo</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
