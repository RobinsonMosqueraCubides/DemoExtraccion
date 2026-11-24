import type { InvoiceExtraction, TotalesPorCuenta } from './schema';

export interface InvoiceFileInfo {
  filename: string;
  sizeBytes: number;
  modifiedAt: string;
}

export type ValidationClassification =
  | 'CUADRA'
  | 'DESCUADRE'
  | 'NO_VALIDA'
  | 'ERROR';

export type JobStatus =
  | 'queued'
  | 'processing'
  | 'retrying'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

export interface LocalMathAudit {
  strictContractPass: boolean;
  schemaValid: boolean;
  isDocumentValid: boolean;
  calcSumaConceptos: number;
  calcTotalesPorCuenta: TotalesPorCuenta;
  calcSumaCuentas: number;
  cuadreCuentasOk: boolean;
  cuadreTotalOk: boolean;
  modelCuadraFlag: boolean;
  discrepancies: string[];
  classification: ValidationClassification;
}

export interface InvoiceJobResult {
  filename: string;
  status: JobStatus;
  attempts: number;
  latencyMs: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  usage: TokenUsage | null;
  estimatedCostUsd: number;
  rawText: string | null;
  data: InvoiceExtraction | null;
  audit: LocalMathAudit | null;
  error: string | null;
}

export interface RunConfig {
  files: string[];
  concurrency: number;
  cacheWarmup: boolean;
}

export interface RunMetrics {
  totalFiles: number;
  completedCount: number;
  failedCount: number;
  cuadraCount: number;
  descuadreCount: number;
  noValidaCount: number;
  errorCount: number;
  elapsedMs: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  throughputPerSec: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;
  totalCacheReadTokens: number;
  cacheHitRate: number;
  estimatedCostUsd: number;
  totalsByAccount: TotalesPorCuenta;
  grandTotalCop: number;
}

export type RunLifecycleStatus =
  | 'running'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface ExtractionRunRecord {
  runId: string;
  model: string;
  createdAt: string;
  finishedAt: string | null;
  status: RunLifecycleStatus;
  config: RunConfig;
  metrics: RunMetrics;
  results: InvoiceJobResult[];
}

export interface BenchmarkSummary {
  runId: string;
  model: string;
  createdAt: string;
  finishedAt: string | null;
  status: RunLifecycleStatus;
  totalFiles: number;
  concurrency: number;
  cacheWarmup: boolean;
  elapsedMs: number;
  throughputPerSec: number;
  cuadraCount: number;
  descuadreCount: number;
  noValidaCount: number;
  errorCount: number;
  cacheHitRate: number;
  estimatedCostUsd: number;
}

export type SseEvent =
  | { type: 'run:snapshot'; run: ExtractionRunRecord }
  | { type: 'invoice:processing'; filename: string; attempt: number; startedAt: string }
  | { type: 'invoice:retrying'; filename: string; attempt: number; reason: string }
  | { type: 'invoice:done'; result: InvoiceJobResult; metrics: RunMetrics }
  | { type: 'invoice:error'; result: InvoiceJobResult; metrics: RunMetrics }
  | { type: 'run:completed'; run: ExtractionRunRecord }
  | { type: 'run:cancelled'; run: ExtractionRunRecord };
