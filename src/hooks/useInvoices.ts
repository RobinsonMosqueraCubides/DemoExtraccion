import { useCallback, useEffect, useState } from 'react';
import type { InvoiceFileInfo } from '../../shared/types';

interface InvoicesApiResponse {
  folder: string;
  defaultConcurrency: number;
  maxConcurrency: number;
  model: string;
  hasApiKey: boolean;
  files: InvoiceFileInfo[];
}

export function useInvoices() {
  const [files, setFiles] = useState<InvoiceFileInfo[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [folder, setFolder] = useState<string>('./facturas');
  const [model, setModel] = useState<string>('claude-sonnet-5-5');
  const [defaultConcurrency, setDefaultConcurrency] = useState<number>(8);
  const [maxConcurrency, setMaxConcurrency] = useState<number>(20);
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/invoices');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as InvoicesApiResponse;
      setFiles(data.files);
      setFolder(data.folder);
      setModel(data.model);
      setDefaultConcurrency(data.defaultConcurrency);
      setMaxConcurrency(data.maxConcurrency);
      setHasApiKey(data.hasApiKey);
      setSelectedFiles(new Set(data.files.map((f) => f.filename)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleFile = useCallback((filename: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedFiles(new Set(files.map((f) => f.filename)));
  }, [files]);

  const selectFirstN = useCallback(
    (n: number) => {
      setSelectedFiles(new Set(files.slice(0, n).map((f) => f.filename)));
    },
    [files]
  );

  const clearSelection = useCallback(() => {
    setSelectedFiles(new Set());
  }, []);

  return {
    files,
    selectedFiles,
    folder,
    model,
    defaultConcurrency,
    maxConcurrency,
    hasApiKey,
    loading,
    error,
    refresh,
    toggleFile,
    selectAll,
    selectFirstN,
    clearSelection,
  };
}
