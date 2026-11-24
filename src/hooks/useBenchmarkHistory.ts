import { useCallback, useEffect, useState } from 'react';
import type { BenchmarkSummary } from '../../shared/types';

export function useBenchmarkHistory() {
  const [benchmarks, setBenchmarks] = useState<BenchmarkSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/runs');
      if (!res.ok) return;
      const data = (await res.json()) as { benchmarks: BenchmarkSummary[] };
      setBenchmarks(data.benchmarks);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { benchmarks, loading, refresh };
}
