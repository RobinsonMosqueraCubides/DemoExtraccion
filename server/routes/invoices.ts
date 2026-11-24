import { Router } from 'express';
import { CONFIG } from '../config.js';
import {
  listInvoiceFiles,
  resolveInvoicePdfPath,
} from '../services/invoiceScanner.js';

export const invoicesRouter = Router();

invoicesRouter.get('/', async (_req, res) => {
  try {
    const files = await listInvoiceFiles();
    res.json({
      folder: CONFIG.facturasDir,
      defaultConcurrency: CONFIG.defaultConcurrency,
      maxConcurrency: CONFIG.maxConcurrency,
      model: CONFIG.anthropicModel,
      hasApiKey: Boolean(CONFIG.anthropicApiKey),
      files,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

invoicesRouter.get('/:filename/pdf', (req, res) => {
  try {
    const filePath = resolveInvoicePdfPath(req.params.filename);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${req.params.filename}"`);
    res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: 'PDF no encontrado.' });
      }
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});
