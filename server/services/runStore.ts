import fs from 'node:fs/promises';
import path from 'node:path';
import { CONFIG } from '../config.js';
import type { BenchmarkSummary, ExtractionRunRecord } from '../../shared/types.js';

function sanitizeRunId(runId: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(runId)) {
    throw new Error(`runId inválido: ${runId}`);
  }
  return runId;
}

export async function saveRunRecord(run: ExtractionRunRecord): Promise<void> {
  await fs.mkdir(CONFIG.outputsDir, { recursive: true });
  const safeId = sanitizeRunId(run.runId);
  const filePath = path.join(CONFIG.outputsDir, `${safeId}.json`);
  await fs.writeFile(filePath, JSON.stringify(run, null, 2), 'utf-8');
}

export async function loadRunRecord(runId: string): Promise<ExtractionRunRecord | null> {
  const safeId = sanitizeRunId(runId);
  const filePath = path.join(CONFIG.outputsDir, `${safeId}.json`);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as ExtractionRunRecord;
  } catch {
    return null;
  }
}

export async function listBenchmarkSummaries(): Promise<BenchmarkSummary[]> {
  await fs.mkdir(CONFIG.outputsDir, { recursive: true });
  const entries = await fs.readdir(CONFIG.outputsDir, { withFileTypes: true });
  const jsonFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.json'));

  const summaries = await Promise.all(
    jsonFiles.map(async (entry) => {
      try {
        const raw = await fs.readFile(path.join(CONFIG.outputsDir, entry.name), 'utf-8');
        const run = JSON.parse(raw) as ExtractionRunRecord;
        const summary: BenchmarkSummary = {
          runId: run.runId,
          model: run.model,
          createdAt: run.createdAt,
          finishedAt: run.finishedAt,
          status: run.status,
          totalFiles: run.metrics.totalFiles,
          concurrency: run.config.concurrency,
          cacheWarmup: run.config.cacheWarmup,
          elapsedMs: run.metrics.elapsedMs,
          throughputPerSec: run.metrics.throughputPerSec,
          cuadraCount: run.metrics.cuadraCount,
          descuadreCount: run.metrics.descuadreCount,
          noValidaCount: run.metrics.noValidaCount,
          errorCount: run.metrics.errorCount,
          cacheHitRate: run.metrics.cacheHitRate,
          estimatedCostUsd: run.metrics.estimatedCostUsd,
        };
        return summary;
      } catch {
        return null;
      }
    })
  );

  return summaries
    .filter((s): s is BenchmarkSummary => s !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
