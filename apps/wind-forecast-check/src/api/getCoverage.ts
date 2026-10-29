import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { loadDataset, rowsForDay, janDays } from '../lib/wind';

export default createEndpoint({
  description: 'Data coverage report for January 2026 at a chosen deadline',
  inputSchema: z.object({ deadline: z.string() }),
  outputSchema: z.object({
    expected: z.number(), actualsFound: z.number(), forecastRowsFetched: z.number(), forecastRowsKept: z.number(),
    exactDuplicatesDropped: z.number(), conflictsFlagged: z.number(), conflictExamples: z.array(z.string()),
    februaryTrimmed: z.number(), actualMultiples: z.number(), halfHoursWithAnyForecast: z.number(),
    matchedPairs: z.number(), noEligibleForecast: z.number(), missing: z.number(), coveragePct: z.number(),
    maxLeadHours: z.number(), earliestEligibleForJan1: z.string().nullable(), windowOk: z.boolean(),
    publishHoursUtc: z.array(z.object({ time: z.string(), count: z.number() })),
  }),
  execute: async ({ input }) => {
    const ds = await loadDataset();
    const rows = janDays().flatMap((d) => rowsForDay(ds, d, input.deadline));
    const matched = rows.filter((r) => r.forecast != null && r.actual != null).length;
    const s = ds.stats;
    return {
      expected: rows.length,
      actualsFound: ds.actuals.size,
      forecastRowsFetched: s.forecastRowsFetched,
      forecastRowsKept: s.forecastRowsKept,
      exactDuplicatesDropped: s.exactDuplicatesDropped,
      conflictsFlagged: s.conflictsFlagged,
      conflictExamples: s.conflictExamples,
      februaryTrimmed: s.februaryTrimmed,
      actualMultiples: s.actualMultiples,
      halfHoursWithAnyForecast: rows.filter((r) => r.versions > 0).length,
      matchedPairs: matched,
      noEligibleForecast: rows.filter((r) => r.forecast == null).length,
      missing: rows.length - matched,
      coveragePct: (matched / rows.length) * 100,
      maxLeadHours: s.maxLeadHours,
      earliestEligibleForJan1: s.earliestEligibleForJan1,
      windowOk: s.windowOk,
      publishHoursUtc: s.publishHoursUtc,
    };
  },
});
