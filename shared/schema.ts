import { z } from 'zod';

export const JDE_ACCOUNTS = ['513555.35', '519595.05', '519595.30'] as const;
export type JdeAccount = (typeof JDE_ACCOUNTS)[number];

export const IdentificacionSchema = z
  .object({
    numero_factura: z.string().nullable(),
    numero_contrato: z.string().nullable(),
    numero_cupon: z.string().nullable(),
    numero_medidor: z.string().nullable(),
    titular: z.string().nullable(),
    direccion_predio: z.string().nullable(),
    apto: z.string().nullable(),
    estrato: z.number().int().nullable(),
  })
  .strict();

export const FechasSchema = z
  .object({
    periodo_facturacion_actual: z.string().nullable(),
    periodo_facturacion_anterior: z.string().nullable(),
    fecha_emision: z.string().nullable(),
    primer_vencimiento: z.string().nullable(),
    segundo_vencimiento: z.string().nullable(),
  })
  .strict();

export const ConceptoExtraidoSchema = z
  .object({
    nombre_en_documento: z.string(),
    componente: z.literal('UNICO'),
    valor: z.number().int(),
    cuenta_asignada: z.enum(JDE_ACCOUNTS),
  })
  .strict();

export const TotalesPorCuentaSchema = z
  .object({
    '513555.35': z.number().int(),
    '519595.05': z.number().int(),
    '519595.30': z.number().int(),
  })
  .strict();

export const ValidacionSchema = z
  .object({
    suma_conceptos: z.number().int(),
    total_impreso: z.number().int().nullable(),
    cuadra: z.boolean(),
  })
  .strict();

export const InvoiceExtractionSchema = z
  .object({
    identificacion: IdentificacionSchema,
    fechas: FechasSchema,
    conceptos_extraidos: z.array(ConceptoExtraidoSchema),
    totales_por_cuenta: TotalesPorCuentaSchema,
    saldo_anterior: z.number().int().nullable(),
    cargos_del_mes: z.number().int().nullable(),
    valor_total: z.number().int().nullable(),
    valor_brilla: z.number().int().nullable(),
    consumo_actual: z.number().nullable(),
    consumo_anterior: z.number().nullable(),
    pago_total_anterior: z.number().int().nullable(),
    observaciones: z.array(z.string()),
    validacion: ValidacionSchema,
  })
  .strict();

export type InvoiceExtraction = z.infer<typeof InvoiceExtractionSchema>;
export type ConceptoExtraido = z.infer<typeof ConceptoExtraidoSchema>;
export type TotalesPorCuenta = z.infer<typeof TotalesPorCuentaSchema>;
