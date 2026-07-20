import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export type RangeKey = '24h' | '7d' | '30d' | 'custom';

export function useAdminDateRange() {
  const [params, setParams] = useSearchParams();
  const range = (params.get('range') as RangeKey) || '7d';

  const { from, to } = useMemo(() => {
    const now = new Date();
    const toIso = params.get('to') || now.toISOString();
    if (range === 'custom' && params.get('from')) {
      return { from: params.get('from')!, to: toIso };
    }
    const days = range === '24h' ? 1 : range === '30d' ? 30 : 7;
    const fromDate = new Date(now.getTime() - (days - 1) * 86400000);
    return {
      from: fromDate.toISOString(),
      to: toIso,
      fromDate: fromDate.toISOString().slice(0, 10),
      toDate: now.toISOString().slice(0, 10),
    };
  }, [params, range]);

  const fromDate = (from as string).slice(0, 10);
  const toDate = (to as string).slice(0, 10);

  const setRange = (next: RangeKey) => {
    const sp = new URLSearchParams(params);
    sp.set('range', next);
    if (next !== 'custom') {
      sp.delete('from');
      sp.delete('to');
    }
    setParams(sp);
  };

  return { range, from, to, fromDate, toDate, setRange, params, setParams };
}
