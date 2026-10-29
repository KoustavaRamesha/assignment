import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { loadDataset, rowsForDay, janDays, metrics, type Row } from '../lib/wind';

const m = z.object({ mae: z.number().nullable(), bias: z.number().nullable(), p90: z.number().nullable(), nmae: z.number().nullable(), validPairs: z.number(), meanActual: z.number().nullable(), avgLead: z.number().nullable() });

export default createEndpoint({
  description: 'January look-back accuracy metrics for a chosen deadline',
  inputSchema: z.object({ deadline: z.string() }),
  outputSchema: z.object({
    overall: m,
    byDay: z.array(z.object({ day: z.number(), mae: z.number().nullable(), validPairs: z.number() })),
    byHour: z.array(z.object({ hour: z.number(), mae: z.number().nullable(), avgLead: z.number().nullable(), validPairs: z.number() })),
    expected: z.number(),
  }),
  execute: async ({ input }) => {
    const ds = await loadDataset();
    const all: Row[] = [];
    const byDay = janDays().map((d, i) => {
      const rows = rowsForDay(ds, d, input.deadline);
      all.push(...rows);
      const mm = metrics(rows);
      return { day: i + 1, mae: mm.mae, validPairs: mm.validPairs };
    });
    const byHour = Array.from({ length: 24 }, (_, h) => {
      const mm = metrics(all.filter((r) => new Date(r.startMs).getUTCHours() === h));
      return { hour: h, mae: mm.mae, avgLead: mm.avgLead, validPairs: mm.validPairs };
    });
    return { overall: metrics(all), byDay, byHour, expected: all.length };
  },
});
