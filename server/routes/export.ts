import { Router } from 'express';
import { getActiveRun } from '../services/batchOrchestrator.js';
import {
  exportRunToCsvDetail,
  exportRunToCsvSummary,
  exportRunToXlsxBuffer,
} from '../services/jdeExporter.js';
import { loadRunRecord } from '../services/runStore.js';

export const exportRouter = Router();

exportRouter.get('/:runId/export', async (req, res) => {
  const format = String(req.query.format ?? 'json').toLowerCase();
  const runId = req.params.runId;

  try {
    const run = getActiveRun(runId) ?? (await loadRunRecord(runId));
    if (!run) {
      res.status(404).json({ error: 'Corrida no encontrada para exportar.' });
      return;
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${runId}.json"`);
      res.send(JSON.stringify(run, null, 2));
      return;
    }

    if (format === 'xlsx') {
      const buffer = exportRunToXlsxBuffer(run);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${runId}-jde.xlsx"`
      );
      res.send(buffer);
      return;
    }

    if (format === 'csv-summary') {
      const csv = exportRunToCsvSummary(run);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${runId}-resumen-jde.csv"`
      );
      res.send(csv);
      return;
    }

    if (format === 'csv-detail') {
      const csv = exportRunToCsvDetail(run);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${runId}-detalle-jde.csv"`
      );
      res.send(csv);
      return;
    }

    res.status(400).json({ error: `Formato de exportación no soportado: ${format}` });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
