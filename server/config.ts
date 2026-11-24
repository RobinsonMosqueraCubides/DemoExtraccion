import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const ROOT_DIR = process.cwd();

export const CONFIG = {
  port: Number(process.env.PORT ?? 3001),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5-5',
  anthropicVersion: '2023-06-01',
  anthropicMaxTokens: 6000,
  anthropicEndpoint: 'https://api.anthropic.com/v1/messages',
  maxConcurrency: Number(process.env.MAX_CONCURRENCY ?? 20),
  defaultConcurrency: Number(process.env.DEFAULT_CONCURRENCY ?? 8),
  maxPdfSizeBytes: 32 * 1024 * 1024, // 32 MB límite oficial Anthropic
  requestTimeoutMs: 90_000,
  maxTechnicalRetries: 2,
  facturasDir: path.join(ROOT_DIR, 'facturas'),
  outputsDir: path.join(ROOT_DIR, 'outputs'),
} as const;

// Tarifas referenciales Sonnet (USD por millón de tokens) para estimación en el demo
export const PRICING_PER_MTOK = {
  input: 3.0,
  output: 15.0,
  cacheWrite: 3.75,
  cacheRead: 0.3,
} as const;
