import { Router } from 'express';
import { z } from 'zod';
import { CONFIG } from '../config.js';
import {
  attachSseClient,
  cancelActiveRun,
  getActiveRun,
  startExtractionRun,
} from '../services/batchOrchestrator.js';
import { listInvoiceFiles } from '../services/invoiceScanner.js';
import { listBenchmarkSummaries, loadRunRecord } from '../services/runStore.js';

export const runsRouter = Router();

const StartRunBodySchema = z.object({
  files: z.array(z.string()).optional(),
  concurrency: z.number().int().min(1).max(CONFIG.maxConcurrency).default(CONFIG.defaultConcurrency),
  cacheWarmup: z.boolean().default(true),
});

runsRouter.post('/', async (req, res) => {
  try {
    const parsed = StartRunBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Parámetros de ejecución inválidos.' });
      return;
    }

    let files = parsed.data.files;
    if (!files || files.length === 0) {
      const available = await listInvoiceFiles();
      files = available.map((f) => f.filename);
    }

    const run = await startExtractionRun({
      files,
      concurrency: parsed.data.concurrency,
      cacheWarmup: parsed.data.cacheWarmup,
    });

    res.status(201).json({
      runId: run.runId,
      totalFiles: run.metrics.totalFiles,
      run,
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

runsRouter.get('/', async (_req, res) => {
  try {
    const benchmarks = await listBenchmarkSummaries();
    res.json({ benchmarks });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

runsRouter.get('/:runId/stream', (req, res) => {
  const attached = attachSseClient(req.params.runId, res);
  if (!attached) {
    res.status(404).json({ error: 'Corrida no activa o ya finalizada.' });
  }
});

runsRouter.post('/:runId/cancel', (req, res) => {
  const cancelled = cancelActiveRun(req.params.runId);
  if (!cancelled) {
    res.status(404).json({ error: 'No se encontró una corrida activa con ese ID.' });
    return;
  }
  res.json({ ok: true });
});

runsRouter.get('/:runId', async (req, res) => {
  const active = getActiveRun(req.params.runId);
  if (active) {
    res.json({ run: active });
    return;
  }
  try {
    const stored = await loadRunRecord(req.params.runId);
    if (!stored) {
      res.status(404).json({ error: 'Corrida no encontrada.' });
      return;
    }
    res.json({ run: stored });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});
