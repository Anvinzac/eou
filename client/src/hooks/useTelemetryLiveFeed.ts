import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { openTelemetryStream, type TelemetryEvent } from '@/api/adminTelemetry';

export type LiveConnectionState = 'connected' | 'polling' | 'stale';

export function useTelemetryLiveFeed(enabled: boolean) {
  const queryClient = useQueryClient();
  const [connection, setConnection] = useState<LiveConnectionState>('polling');
  const [lastEventAt, setLastEventAt] = useState<number>(Date.now());

  useEffect(() => {
    if (!enabled) return;

    let closed = false;
    setConnection('polling');

    const stop = openTelemetryStream((event) => {
      if (closed) return;
      setConnection('connected');
      setLastEventAt(Date.now());
      queryClient.setQueryData<{ events: TelemetryEvent[]; nextCursor: string | null }>(
        ['admin', 'events', 'feed'],
        (prev) => {
          const existing = prev?.events || [];
          const next = [event, ...existing.filter((e) => e.id !== event.id)].slice(0, 50);
          return { events: next, nextCursor: prev?.nextCursor || null };
        },
      );
      void queryClient.invalidateQueries({ queryKey: ['admin', 'summary'] });
    });

    const staleTimer = setInterval(() => {
      if (Date.now() - lastEventAt > 120_000) setConnection('stale');
    }, 10_000);

    return () => {
      closed = true;
      stop();
      clearInterval(staleTimer);
    };
  }, [enabled, queryClient]);

  return { connection };
}
