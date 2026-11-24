import { InvoiceExtractionSchema, type InvoiceExtraction } from '../../shared/schema.js';
import type { LocalMathAudit } from '../../shared/types.js';

export interface ParseAndAuditResult {
  ok: boolean;
  data: InvoiceExtraction | null;
  audit: LocalMathAudit | null;
  retryableError?: string;
}

function tryStripMarkdownFence(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

export function parseAndAuditResponse(rawText: string): ParseAndAuditResult {
  const trimmed = rawText.trim();
  const strictContractPass = trimmed.startsWith('{') && trimmed.endsWith('}');

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(trimmed);
  } catch {
    const cleaned = tryStripMarkdownFence(trimmed);
    try {
      parsedJson = JSON.parse(cleaned);
    } catch (err) {
      return {
        ok: false,
        data: null,
        audit: null,
        retryableError: `JSON inválido devuelto por el modelo: ${(err as Error).message}`,
      };
    }
  }

  const schemaResult = InvoiceExtractionSchema.safeParse(parsedJson);
  if (!schemaResult.success) {
    const issues = schemaResult.error.issues
      .slice(0, 4)
      .map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
      .join('; ');
    return {
      ok: false,
      data: null,
      audit: null,
      retryableError: `Esquema JSON inválido: ${issues}`,
    };
  }

  const data = schemaResult.data;

  // Detectar si el modelo clasificó el documento como NO válido según <documentos_no_validos>
  const allIdNull = Object.values(data.identificacion).every((v) => v === null);
  const allDatesNull = Object.values(data.fechas).every((v) => v === null);
  const isNoValidaDoc =
    allIdNull &&
    allDatesNull &&
    data.conceptos_extraidos.length === 0 &&
    data.valor_total === null &&
    data.validacion.total_impreso === null &&
    data.validacion.cuadra === false;

  const calcTotalesPorCuenta = {
    '513555.35': 0,
    '519595.05': 0,
    '519595.30': 0,
  };

  let calcSumaConceptos = 0;
  for (const item of data.conceptos_extraidos) {
    calcSumaConceptos += item.valor;
    calcTotalesPorCuenta[item.cuenta_asignada] += item.valor;
  }

  const calcSumaCuentas =
    calcTotalesPorCuenta['513555.35'] +
    calcTotalesPorCuenta['519595.05'] +
    calcTotalesPorCuenta['519595.30'];

  const discrepancies: string[] = [];

  if (!strictContractPass) {
    discrepancies.push('El modelo incluyó texto o delimitadores fuera de { ... }.');
  }

  if (isNoValidaDoc) {
    return {
      ok: true,
      data,
      audit: {
        strictContractPass,
        schemaValid: true,
        isDocumentValid: false,
        calcSumaConceptos,
        calcTotalesPorCuenta,
        calcSumaCuentas,
        cuadreCuentasOk: true,
        cuadreTotalOk: true,
        modelCuadraFlag: data.validacion.cuadra,
        discrepancies,
        classification: 'NO_VALIDA',
      },
    };
  }

  // Verificar coincidencia de totales_por_cuenta reportados vs recalculados
  for (const acct of ['513555.35', '519595.05', '519595.30'] as const) {
    if (data.totales_por_cuenta[acct] !== calcTotalesPorCuenta[acct]) {
      discrepancies.push(
        `Cuenta ${acct}: modelo=${data.totales_por_cuenta[acct]}, suma conceptos=${calcTotalesPorCuenta[acct]}`
      );
    }
  }

  if (data.validacion.suma_conceptos !== calcSumaConceptos) {
    discrepancies.push(
      `suma_conceptos: modelo=${data.validacion.suma_conceptos}, recalculado=${calcSumaConceptos}`
    );
  }

  const cuadreCuentasOk =
    calcSumaCuentas === calcSumaConceptos &&
    data.totales_por_cuenta['513555.35'] === calcTotalesPorCuenta['513555.35'] &&
    data.totales_por_cuenta['519595.05'] === calcTotalesPorCuenta['519595.05'] &&
    data.totales_por_cuenta['519595.30'] === calcTotalesPorCuenta['519595.30'];

  const saldoAnterior = data.saldo_anterior ?? 0;
  const valorTotal = data.valor_total;
  const cuadreTotalOk =
    valorTotal !== null &&
    (calcSumaConceptos + saldoAnterior === valorTotal || calcSumaConceptos === valorTotal);

  if (!cuadreTotalOk) {
    discrepancies.push(
      `Cuadre total: suma_conceptos (${calcSumaConceptos}) + saldo_anterior (${saldoAnterior}) = ${
        calcSumaConceptos + saldoAnterior
      } vs valor_total (${valorTotal ?? 'null'})`
    );
  }

  if (
    data.validacion.total_impreso !== null &&
    data.valor_total !== null &&
    data.validacion.total_impreso !== data.valor_total
  ) {
    discrepancies.push(
      `total_impreso (${data.validacion.total_impreso}) difiere de valor_total (${data.valor_total})`
    );
  }

  const isCuadra = data.validacion.cuadra && cuadreCuentasOk && cuadreTotalOk && discrepancies.length === 0;

  return {
    ok: true,
    data,
    audit: {
      strictContractPass,
      schemaValid: true,
      isDocumentValid: true,
      calcSumaConceptos,
      calcTotalesPorCuenta,
      calcSumaCuentas,
      cuadreCuentasOk,
      cuadreTotalOk,
      modelCuadraFlag: data.validacion.cuadra,
      discrepancies,
      classification: isCuadra ? 'CUADRA' : 'DESCUADRE',
    },
  };
}
