import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { loadDataset, rowsForDay, PRESETS, mwh, metrics } from '../lib/wind';

export default createEndpoint({
  description: 'Forecast vs actual wind for one January 2026 delivery day at a chosen deadline',
  inputSchema: z.object({ day: z.number().int().min(1).max(31), deadline: z.string() }),
  outputSchema: z.object({
    rows: z.array(z.object({ startTime: z.string(), forecast: z.number().nullable(), actual: z.number().nullable(), publishTime: z.string().nullable(), leadHours: z.number().nullable() })),
    publishTimesUsed: z.array(z.string()),
    forecastMwh: z.number(), actualMwh: z.number(),
    minForecast: z.object({ time: z.string(), mw: z.number() }).nullable(),
    maxForecast: z.object({ time: z.string(), mw: z.number() }).nullable(),
    missing: z.number(),
    sameAsPresets: z.array(z.string()),
    mae: z.number().nullable(),
  }),
  execute: async ({ input }) => {
    const ds = await loadDataset();
    const dayMs = Date.UTC(2026, 0, input.day);
    const rows = rowsForDay(ds, dayMs, input.deadline);
    const sig = (r: typeof rows) => r.map((x) => x.publishMs ?? 'x').join(',');
    const mine = sig(rows);
    const sameAsPresets = PRESETS.filter((p) => p !== input.deadline && sig(rowsForDay(ds, dayMs, p)) === mine);
    const withF = rows.filter((r) => r.forecast != null);
    const sorted = [...withF].sort((a, b) => a.forecast! - b.forecast!);
    const iso = (ms: number) => new Date(ms).toISOString();
    return {
      rows: rows.map((r) => ({ startTime: iso(r.startMs), forecast: r.forecast, actual: r.actual, publishTime: r.publishMs ? iso(r.publishMs) : null, leadHours: r.leadHours })),
      publishTimesUsed: [...new Set(withF.map((r) => r.publishMs!))].sort().map(iso),
      forecastMwh: mwh(rows.map((r) => r.forecast)),
      actualMwh: mwh(rows.map((r) => r.actual)),
      minForecast: sorted[0] ? { time: iso(sorted[0].startMs), mw: sorted[0].forecast! } : null,
      maxForecast: sorted.length ? { time: iso(sorted[sorted.length - 1].startMs), mw: sorted[sorted.length - 1].forecast! } : null,
      missing: rows.filter((r) => r.forecast == null || r.actual == null).length,
      sameAsPresets,
      mae: metrics(rows).mae,
    };
  },
});
