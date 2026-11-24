import * as XLSX from 'xlsx';
import type { ExtractionRunRecord } from '../../shared/types.js';

export interface SummaryRow {
  archivo: string;
  estado_validacion: string;
  cuadra_modelo: boolean | string;
  cuadra_auditoria: boolean | string;
  tiempo_ms: number | null;
  intentos: number;
  numero_factura: string | null;
  numero_contrato: string | null;
  numero_cupon: string | null;
  numero_medidor: string | null;
  titular: string | null;
  direccion_predio: string | null;
  apto: string | null;
  estrato: number | null;
  periodo_facturacion_actual: string | null;
  fecha_emision: string | null;
  primer_vencimiento: string | null;
  segundo_vencimiento: string | null;
  consumo_actual: number | null;
  consumo_anterior: number | null;
  saldo_anterior: number | null;
  cargos_del_mes: number | null;
  cta_513555_35: number | null;
  cta_519595_05: number | null;
  cta_519595_30: number | null;
  valor_total: number | null;
  valor_brilla: number | null;
  pago_total_anterior: number | null;
  observaciones: string;
}

export interface DetailRow {
  archivo: string;
  numero_factura: string | null;
  numero_contrato: string | null;
  fecha_emision: string | null;
  primer_vencimiento: string | null;
  titular: string | null;
  cuenta_asignada: string;
  nombre_en_documento: string;
  componente: string;
  valor: number;
  cuadra_auditoria: boolean;
}

export function buildJdeSummaryRows(run: ExtractionRunRecord): SummaryRow[] {
  return run.results.map((r) => {
    const d = r.data;
    const cls = r.audit?.classification ?? 'ERROR';
    const auditOk =
      cls === 'CUADRA'
        ? true
        : cls === 'DESCUADRE'
          ? false
          : cls;

    return {
      archivo: r.filename,
      estado_validacion: cls,
      cuadra_modelo: d ? d.validacion.cuadra : 'N/A',
      cuadra_auditoria: auditOk,
      tiempo_ms: r.latencyMs,
      intentos: r.attempts,
      numero_factura: d?.identificacion.numero_factura ?? null,
      numero_contrato: d?.identificacion.numero_contrato ?? null,
      numero_cupon: d?.identificacion.numero_cupon ?? null,
      numero_medidor: d?.identificacion.numero_medidor ?? null,
      titular: d?.identificacion.titular ?? null,
      direccion_predio: d?.identificacion.direccion_predio ?? null,
      apto: d?.identificacion.apto ?? null,
      estrato: d?.identificacion.estrato ?? null,
      periodo_facturacion_actual: d?.fechas.periodo_facturacion_actual ?? null,
      fecha_emision: d?.fechas.fecha_emision ?? null,
      primer_vencimiento: d?.fechas.primer_vencimiento ?? null,
      segundo_vencimiento: d?.fechas.segundo_vencimiento ?? null,
      consumo_actual: d?.consumo_actual ?? null,
      consumo_anterior: d?.consumo_anterior ?? null,
      saldo_anterior: d?.saldo_anterior ?? null,
      cargos_del_mes: d?.cargos_del_mes ?? null,
      cta_513555_35: d ? d.totales_por_cuenta['513555.35'] : null,
      cta_519595_05: d ? d.totales_por_cuenta['519595.05'] : null,
      cta_519595_30: d ? d.totales_por_cuenta['519595.30'] : null,
      valor_total: d?.valor_total ?? null,
      valor_brilla: d?.valor_brilla ?? null,
      pago_total_anterior: d?.pago_total_anterior ?? null,
      observaciones: d?.observaciones.join(' | ') ?? r.error ?? '',
    };
  });
}

export function buildJdeDetailRows(run: ExtractionRunRecord): DetailRow[] {
  const rows: DetailRow[] = [];
  for (const r of run.results) {
    if (!r.data) continue;
    const cuadraAuditoria = r.audit?.classification === 'CUADRA';
    for (const c of r.data.conceptos_extraidos) {
      rows.push({
        archivo: r.filename,
        numero_factura: r.data.identificacion.numero_factura,
        numero_contrato: r.data.identificacion.numero_contrato,
        fecha_emision: r.data.fechas.fecha_emision,
        primer_vencimiento: r.data.fechas.primer_vencimiento,
        titular: r.data.identificacion.titular,
        cuenta_asignada: c.cuenta_asignada,
        nombre_en_documento: c.nombre_en_documento,
        componente: c.componente,
        valor: c.valor,
        cuadra_auditoria: cuadraAuditoria,
      });
    }
  }
  return rows;
}

export function exportRunToXlsxBuffer(run: ExtractionRunRecord): Buffer {
  const wb = XLSX.utils.book_new();
  const summaryRows = buildJdeSummaryRows(run);
  const detailRows = buildJdeDetailRows(run);

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  const wsDetail = XLSX.utils.json_to_sheet(detailRows);

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen_Facturas');
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Detalle_Conceptos_JDE');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function toCsvWithBom(rows: object[]): string {
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  return `\uFEFF${csv}`;
}

export function exportRunToCsvSummary(run: ExtractionRunRecord): string {
  return toCsvWithBom(buildJdeSummaryRows(run));
}

export function exportRunToCsvDetail(run: ExtractionRunRecord): string {
  return toCsvWithBom(buildJdeDetailRows(run));
}
