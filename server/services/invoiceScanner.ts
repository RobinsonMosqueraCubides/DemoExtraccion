import fs from 'node:fs/promises';
import path from 'node:path';
import { CONFIG } from '../config.js';
import type { InvoiceFileInfo } from '../../shared/types.js';

export interface PreloadedInvoice {
  filename: string;
  sizeBytes: number;
  base64: string;
}

export function sanitizeFilename(filename: string): string {
  const base = path.basename(filename);
  if (base !== filename || !base.toLowerCase().endsWith('.pdf')) {
    throw new Error(`Nombre de archivo inválido: ${filename}`);
  }
  return base;
}

export async function listInvoiceFiles(): Promise<InvoiceFileInfo[]> {
  await fs.mkdir(CONFIG.facturasDir, { recursive: true });
  const entries = await fs.readdir(CONFIG.facturasDir, { withFileTypes: true });

  const pdfEntries = entries.filter(
    (entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')
  );

  const files = await Promise.all(
    pdfEntries.map(async (entry) => {
      const fullPath = path.join(CONFIG.facturasDir, entry.name);
      const stat = await fs.stat(fullPath);
      return {
        filename: entry.name,
        sizeBytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      };
    })
  );

  return files.sort((a, b) =>
    a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' })
  );
}

export async function preloadInvoices(filenames: string[]): Promise<PreloadedInvoice[]> {
  return Promise.all(
    filenames.map(async (rawName) => {
      const filename = sanitizeFilename(rawName);
      const fullPath = path.join(CONFIG.facturasDir, filename);
      const buffer = await fs.readFile(fullPath);

      if (buffer.length === 0) {
        throw new Error(`El archivo ${filename} está vacío (0 bytes).`);
      }
      if (buffer.length > CONFIG.maxPdfSizeBytes) {
        throw new Error(
          `El archivo ${filename} supera el límite de 32 MB (${(buffer.length / (1024 * 1024)).toFixed(2)} MB).`
        );
      }
      if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
        throw new Error(`El archivo ${filename} no tiene una cabecera %PDF- válida.`);
      }

      return {
        filename,
        sizeBytes: buffer.length,
        base64: buffer.toString('base64'),
      };
    })
  );
}

export function resolveInvoicePdfPath(filename: string): string {
  const safe = sanitizeFilename(filename);
  return path.join(CONFIG.facturasDir, safe);
}
