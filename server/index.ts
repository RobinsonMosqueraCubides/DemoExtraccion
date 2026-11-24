import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { CONFIG } from './config.js';
import { exportRouter } from './routes/export.js';
import { invoicesRouter } from './routes/invoices.js';
import { runsRouter } from './routes/runs.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    model: CONFIG.anthropicModel,
    hasApiKey: Boolean(CONFIG.anthropicApiKey),
  });
});

app.use('/api/invoices', invoicesRouter);
app.use('/api/runs', runsRouter);
app.use('/api/runs', exportRouter);

if (process.env.NODE_ENV === 'production') {
  const distDir = path.join(process.cwd(), 'dist');
  app.use(express.static(distDir));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(CONFIG.port, () => {
  console.log(
    `[API] Servidor listo en http://localhost:${CONFIG.port} | Modelo: ${CONFIG.anthropicModel}`
  );
});
