import crypto from 'node:crypto';
import type { Response } from 'express';
import { CONFIG } from '../config.js';
import type {
  ExtractionRunRecord,
  InvoiceJobResult,
  RunConfig,
  RunMetrics,
  SseEvent,
} from '../../shared/types.js';
import {
  AnthropicApiError,
  callAnthropicForInvoice,
  type RateLimitSnapshot,
} from './anthropicClient.js';
import { parseAndAuditResponse } from './deterministicValidator.js';
import { preloadInvoices, type PreloadedInvoice } from './invoiceScanner.js';
import { saveRunRecord } from './runStore.js';

interface ActiveRunContext {
  record: ExtractionRunRecord;
  abortController: AbortController;
  clients: Set<Response>;
  startTimeMs: number;
  adaptivePauseUntilMs: number;
}

const activeRuns = new Map<string, ActiveRunContext>();

function createEmptyMetrics(totalFiles: number): RunMetrics {
  return {
    totalFiles,
    completedCount: 0,
    failedCount: 0,
    cuadraCount: 0,
    descuadreCount: 0,
    noValidaCount: 0,
    errorCount: 0,
    elapsedMs: 0,
    avgLatencyMs: 0,
    p95LatencyMs: 0,
    throughputPerSec: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheCreationTokens: 0,
    totalCacheReadTokens: 0,
    cacheHitRate: 0,
    estimatedCostUsd: 0,
    totalsByAccount: {
      '513555.35': 0,
      '519595.05': 0,
      '519595.30': 0,
    },
    grandTotalCop: 0,
  };
}

function recomputeMetrics(
  results: InvoiceJobResult[],
  elapsedMs: number
): RunMetrics {
  const metrics = createEmptyMetrics(results.length);
  metrics.elapsedMs = Math.max(0, Math.round(elapsedMs));

  const latencies: number[] = [];

  for (const r of results) {
    if (r.status === 'completed') {
      metrics.completedCount++;
      if (r.latencyMs !== null) latencies.push(r.latencyMs);

      const cls = r.audit?.classification;
      if (cls === 'CUADRA') metrics.cuadraCount++;
      else if (cls === 'DESCUADRE') metrics.descuadreCount++;
      else if (cls === 'NO_VALIDA') metrics.noValidaCount++;

      if (r.data && r.audit?.isDocumentValid) {
        metrics.totalsByAccount['513555.35'] += r.data.totales_por_cuenta['513555.35'];
        metrics.totalsByAccount['519595.05'] += r.data.totales_por_cuenta['519595.05'];
        metrics.totalsByAccount['519595.30'] += r.data.totales_por_cuenta['519595.30'];
        metrics.grandTotalCop += r.data.valor_total ?? 0;
      }
    } else if (r.status === 'failed') {
      metrics.failedCount++;
      metrics.errorCount++;
      if (r.latencyMs !== null) latencies.push(r.latencyMs);
    }

    if (r.usage) {
      metrics.totalInputTokens += r.usage.inputTokens;
      metrics.totalOutputTokens += r.usage.outputTokens;
      metrics.totalCacheCreationTokens += r.usage.cacheCreationInputTokens;
      metrics.totalCacheReadTokens += r.usage.cacheReadInputTokens;
    }
    metrics.estimatedCostUsd = Number(
      (metrics.estimatedCostUsd + r.estimatedCostUsd).toFixed(6)
    );
  }

  const finishedCount = metrics.completedCount + metrics.failedCount;
  if (latencies.length > 0) {
    latencies.sort((a, b) => a - b);
    const sum = latencies.reduce((acc, v) => acc + v, 0);
    metrics.avgLatencyMs = Math.round(sum / latencies.length);
    const p95Idx = Math.min(
      latencies.length - 1,
      Math.floor(latencies.length * 0.95)
    );
    metrics.p95LatencyMs = Math.round(latencies[p95Idx]);
  }

  if (metrics.elapsedMs > 0 && finishedCount > 0) {
    metrics.throughputPerSec = Number(
      (finishedCount / (metrics.elapsedMs / 1000)).toFixed(2)
    );
  }

  const totalAllInput =
    metrics.totalInputTokens +
    metrics.totalCacheCreationTokens +
    metrics.totalCacheReadTokens;
  if (totalAllInput > 0) {
    metrics.cacheHitRate = Number(
      ((metrics.totalCacheReadTokens / totalAllInput) * 100).toFixed(1)
    );
  }

  return metrics;
}

function emitSse(ctx: ActiveRunContext, event: SseEvent): void {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of ctx.clients) {
    try {
      res.write(payload);
    } catch {
      ctx.clients.delete(res);
    }
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('Aborted'));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Aborted'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function applyRateLimitHint(ctx: ActiveRunContext, rateLimit: RateLimitSnapshot): void {
  if (
    (rateLimit.requestsRemaining !== null && rateLimit.requestsRemaining <= 2) ||
    (rateLimit.inputTokensRemaining !== null && rateLimit.inputTokensRemaining < 8000)
  ) {
    const pauseMs = Math.max(800, (rateLimit.retryAfterSec ?? 2) * 1000);
    ctx.adaptivePauseUntilMs = Math.max(ctx.adaptivePauseUntilMs, Date.now() + pauseMs);
  }
}

async function processSingleInvoice(
  ctx: ActiveRunContext,
  invoice: PreloadedInvoice,
  index: number
): Promise<void> {
  const signal = ctx.abortController.signal;
  const maxAttempts = 1 + CONFIG.maxTechnicalRetries;
  const job = ctx.record.results[index];

  const startedAt = new Date().toISOString();
  const jobStartMs = performance.now();
  job.startedAt = startedAt;
  job.status = 'processing';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal.aborted) {
      job.status = 'cancelled';
      return;
    }

    const waitMs = ctx.adaptivePauseUntilMs - Date.now();
    if (waitMs > 0) {
      await sleep(waitMs, signal).catch(() => {});
    }

    job.attempts = attempt;
    if (attempt === 1) {
      emitSse(ctx, {
        type: 'invoice:processing',
        filename: invoice.filename,
        attempt,
        startedAt,
      });
    }

    try {
      const apiRes = await callAnthropicForInvoice(invoice.base64, signal);
      applyRateLimitHint(ctx, apiRes.rateLimit);

      job.usage = apiRes.usage;
      job.estimatedCostUsd = apiRes.estimatedCostUsd;
      job.rawText = apiRes.rawText;

      if (apiRes.stopReason === 'max_tokens') {
        throw new AnthropicApiError(
          'Respuesta truncada por max_tokens (6000).',
          500,
          true
        );
      }

      const validation = parseAndAuditResponse(apiRes.rawText);
      if (!validation.ok) {
        throw new AnthropicApiError(
          validation.retryableError ?? 'Salida JSON inválida.',
          422,
          true
        );
      }

      job.status = 'completed';
      job.data = validation.data;
      job.audit = validation.audit;
      job.error = null;
      job.finishedAt = new Date().toISOString();
      job.latencyMs = Math.round(performance.now() - jobStartMs);

      ctx.record.metrics = recomputeMetrics(
        ctx.record.results,
        performance.now() - ctx.startTimeMs
      );
      emitSse(ctx, {
        type: 'invoice:done',
        result: job,
        metrics: ctx.record.metrics,
      });
      return;
    } catch (err) {
      if (signal.aborted) {
        job.status = 'cancelled';
        return;
      }

      const apiErr = err instanceof AnthropicApiError ? err : null;
      const isRetryable = apiErr ? apiErr.retryable : true;
      const message = (err as Error).message;

      if (isRetryable && attempt < maxAttempts) {
        job.status = 'retrying';
        emitSse(ctx, {
          type: 'invoice:retrying',
          filename: invoice.filename,
          attempt: attempt + 1,
          reason: message,
        });

        const baseDelay = apiErr?.retryAfterSec
          ? apiErr.retryAfterSec * 1000
          : 1500 * Math.pow(2, attempt - 1);
        const jitter = Math.floor(Math.random() * 450);
        await sleep(baseDelay + jitter, signal).catch(() => {});
        continue;
      }

      job.status = 'failed';
      job.error = message;
      job.finishedAt = new Date().toISOString();
      job.latencyMs = Math.round(performance.now() - jobStartMs);
      job.audit = {
        strictContractPass: false,
        schemaValid: false,
        isDocumentValid: false,
        calcSumaConceptos: 0,
        calcTotalesPorCuenta: { '513555.35': 0, '519595.05': 0, '519595.30': 0 },
        calcSumaCuentas: 0,
        cuadreCuentasOk: false,
        cuadreTotalOk: false,
        modelCuadraFlag: false,
        discrepancies: [message],
        classification: 'ERROR',
      };

      ctx.record.metrics = recomputeMetrics(
        ctx.record.results,
        performance.now() - ctx.startTimeMs
      );
      emitSse(ctx, {
        type: 'invoice:error',
        result: job,
        metrics: ctx.record.metrics,
      });
      return;
    }
  }
}

export async function startExtractionRun(
  config: RunConfig
): Promise<ExtractionRunRecord> {
  if (config.files.length === 0) {
    throw new Error('Debes seleccionar al menos un archivo PDF para procesar.');
  }

  const boundedConcurrency = Math.max(
    1,
    Math.min(CONFIG.maxConcurrency, Math.floor(config.concurrency))
  );

  // Precarga paralela desde disco antes de iniciar el cronómetro de inferencia
  const preloaded = await preloadInvoices(config.files);

  const now = new Date();
  const stamp = now
    .toISOString()
    .replace(/[-:T]/g, '')
    .slice(0, 14);
  const runId = `run-${stamp}-${crypto.randomBytes(2).toString('hex')}`;

  const initialResults: InvoiceJobResult[] = preloaded.map((inv) => ({
    filename: inv.filename,
    status: 'queued',
    attempts: 0,
    latencyMs: null,
    startedAt: null,
    finishedAt: null,
    usage: null,
    estimatedCostUsd: 0,
    rawText: null,
    data: null,
    audit: null,
    error: null,
  }));

  const record: ExtractionRunRecord = {
    runId,
    model: CONFIG.anthropicModel,
    createdAt: now.toISOString(),
    finishedAt: null,
    status: 'running',
    config: {
      files: preloaded.map((p) => p.filename),
      concurrency: boundedConcurrency,
      cacheWarmup: config.cacheWarmup,
    },
    metrics: createEmptyMetrics(preloaded.length),
    results: initialResults,
  };

  const ctx: ActiveRunContext = {
    record,
    abortController: new AbortController(),
    clients: new Set(),
    startTimeMs: performance.now(),
    adaptivePauseUntilMs: 0,
  };

  activeRuns.set(runId, ctx);

  // Ejecutar orquestación en segundo plano
  void executeRunQueue(ctx, preloaded);

  return record;
}

async function executeRunQueue(
  ctx: ActiveRunContext,
  preloaded: PreloadedInvoice[]
): Promise<void> {
  const signal = ctx.abortController.signal;
  let nextIndex = 0;

  try {
    // Warm-up de caché: procesar la factura #1 primero para poblar cache_read en 2..N
    if (ctx.record.config.cacheWarmup && preloaded.length > 1) {
      nextIndex = 1;
      await processSingleInvoice(ctx, preloaded[0], 0);
    }

    const workerCount = Math.min(
      ctx.record.config.concurrency,
      Math.max(0, preloaded.length - nextIndex)
    );

    const workers = Array.from({ length: workerCount }, async () => {
      while (!signal.aborted) {
        const current = nextIndex++;
        if (current >= preloaded.length) break;
        await processSingleInvoice(ctx, preloaded[current], current);
      }
    });

    await Promise.all(workers);

    ctx.record.finishedAt = new Date().toISOString();
    ctx.record.metrics = recomputeMetrics(
      ctx.record.results,
      performance.now() - ctx.startTimeMs
    );

    if (signal.aborted) {
      for (const r of ctx.record.results) {
        if (r.status === 'queued' || r.status === 'processing' || r.status === 'retrying') {
          r.status = 'cancelled';
        }
      }
      ctx.record.status = 'cancelled';
      await saveRunRecord(ctx.record);
      emitSse(ctx, { type: 'run:cancelled', run: ctx.record });
    } else {
      ctx.record.status = 'completed';
      await saveRunRecord(ctx.record);
      emitSse(ctx, { type: 'run:completed', run: ctx.record });
    }
  } catch {
    ctx.record.status = 'failed';
    ctx.record.finishedAt = new Date().toISOString();
    await saveRunRecord(ctx.record).catch(() => {});
  } finally {
    for (const res of ctx.clients) {
      try {
        res.end();
      } catch {
        // noop
      }
    }
    ctx.clients.clear();
    // Mantener en memoria brevemente por si algún cliente se reconecta justo al cierre
    setTimeout(() => activeRuns.delete(ctx.record.runId), 30_000);
  }
}

export function attachSseClient(runId: string, res: Response): boolean {
  const ctx = activeRuns.get(runId);
  if (!ctx) return false;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  ctx.clients.add(res);
  res.write(`data: ${JSON.stringify({ type: 'run:snapshot', run: ctx.record })}\n\n`);

  res.on('close', () => {
    ctx.clients.delete(res);
  });

  return true;
}

export function cancelActiveRun(runId: string): boolean {
  const ctx = activeRuns.get(runId);
  if (!ctx) return false;
  ctx.abortController.abort();
  return true;
}

export function getActiveRun(runId: string): ExtractionRunRecord | null {
  return activeRuns.get(runId)?.record ?? null;
}
