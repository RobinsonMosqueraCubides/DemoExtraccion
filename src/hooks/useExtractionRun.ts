import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExtractionRunRecord, SseEvent } from '../../shared/types';

export function useExtractionRun(onRunFinished?: () => void) {
  const [run, setRun] = useState<ExtractionRunRecord | null>(null);
  const [liveElapsedMs, setLiveElapsedMs] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState<boolean>(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const timerStartRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  const stopTimer = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    timerStartRef.current = performance.now();
    const tick = () => {
      setLiveElapsedMs(Math.round(performance.now() - timerStartRef.current));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopTimer]);

  const closeStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      closeStream();
      stopTimer();
    };
  }, [closeStream, stopTimer]);

  const startRun = useCallback(
    async (files: string[], concurrency: number, cacheWarmup: boolean) => {
      setError(null);
      setIsStarting(true);
      closeStream();

      try {
        const res = await fetch('/api/runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files, concurrency, cacheWarmup }),
        });

        const data = (await res.json()) as {
          runId?: string;
          run?: ExtractionRunRecord;
          error?: string;
        };
        if (!res.ok || !data.run) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }

        setRun(data.run);
        setLiveElapsedMs(0);
        startTimer();

        const es = new EventSource(`/api/runs/${data.run.runId}/stream`);
        eventSourceRef.current = es;

        es.onmessage = (msg) => {
          const event = JSON.parse(msg.data) as SseEvent;

          if (event.type === 'run:snapshot') {
            setRun(event.run);
            return;
          }

          if (event.type === 'invoice:processing') {
            setRun((prev) => {
              if (!prev) return prev;
              const results = prev.results.map((r) =>
                r.filename === event.filename
                  ? {
                      ...r,
                      status: 'processing' as const,
                      attempts: event.attempt,
                      startedAt: event.startedAt,
                    }
                  : r
              );
              return { ...prev, results };
            });
            return;
          }

          if (event.type === 'invoice:retrying') {
            setRun((prev) => {
              if (!prev) return prev;
              const results = prev.results.map((r) =>
                r.filename === event.filename
                  ? {
                      ...r,
                      status: 'retrying' as const,
                      attempts: event.attempt,
                      error: event.reason,
                    }
                  : r
              );
              return { ...prev, results };
            });
            return;
          }

          if (event.type === 'invoice:done' || event.type === 'invoice:error') {
            setRun((prev) => {
              if (!prev) return prev;
              const results = prev.results.map((r) =>
                r.filename === event.result.filename ? event.result : r
              );
              return { ...prev, results, metrics: event.metrics };
            });
            return;
          }

          if (event.type === 'run:completed' || event.type === 'run:cancelled') {
            setRun(event.run);
            setLiveElapsedMs(event.run.metrics.elapsedMs);
            stopTimer();
            closeStream();
            onRunFinished?.();
          }
        };

        es.onerror = () => {
          stopTimer();
          closeStream();
        };
      } catch (err) {
        setError((err as Error).message);
        stopTimer();
      } finally {
        setIsStarting(false);
      }
    },
    [closeStream, onRunFinished, startTimer, stopTimer]
  );

  const cancelRun = useCallback(async () => {
    if (!run || run.status !== 'running') return;
    await fetch(`/api/runs/${run.runId}/cancel`, { method: 'POST' }).catch(
      () => {}
    );
  }, [run]);

  const loadHistoricalRun = useCallback(
    async (runId: string) => {
      closeStream();
      stopTimer();
      setError(null);
      const res = await fetch(`/api/runs/${runId}`);
      if (!res.ok) {
        setError('No se pudo cargar la corrida histórica.');
        return;
      }
      const data = (await res.json()) as { run: ExtractionRunRecord };
      setRun(data.run);
      setLiveElapsedMs(data.run.metrics.elapsedMs);
    },
    [closeStream, stopTimer]
  );

  return {
    run,
    liveElapsedMs,
    isRunning: run?.status === 'running',
    isStarting,
    error,
    startRun,
    cancelRun,
    loadHistoricalRun,
  };
}
