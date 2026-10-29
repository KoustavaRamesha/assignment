import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { loadDataset, deadlineFor, pick } from '../lib/wind';

export default createEndpoint({
  description: 'Proof view: every forecast version for one half-hour, the deadline, and the one picked',
  inputSchema: z.object({ day: z.number().int().min(1).max(31), slot: z.number().int().min(0).max(47), deadline: z.string() }),
  outputSchema: z.object({
    startTime: z.string(), deadline: z.string(), actual: z.number().nullable(),
    versions: z.array(z.object({ publishTime: z.string(), mw: z.number(), leadHours: z.number(), eligible: z.boolean(), picked: z.boolean() })),
  }),
  execute: async ({ input }) => {
    const ds = await loadDataset();
    const dayMs = Date.UTC(2026, 0, input.day);
    const s = dayMs + input.slot * 1800000;
    const dl = deadlineFor(dayMs, input.deadline);
    const vs = ds.forecasts.get(s) ?? [];
    const p = pick(vs, dl);
    return {
      startTime: new Date(s).toISOString(), deadline: new Date(dl).toISOString(), actual: ds.actuals.get(s) ?? null,
      versions: vs.map((v) => ({ publishTime: new Date(v.publishMs).toISOString(), mw: v.mw, leadHours: (s - v.publishMs) / 3600000, eligible: v.publishMs <= dl, picked: v === p })),
    };
  },
});
