import { describe, it, expect } from 'vitest';
import { deadlineFor, pick, rowsForDay, metrics, mwh, forecastMwh, actualMwh, dedupeForecasts, dedupeActuals, janDays, type Dataset, type Row } from '../src/lib/wind';

const T = (iso: string) => Date.parse(iso);
const JAN10 = T('2026-01-10T00:00:00Z');
const row = (startTime: string, publishTime: string, generation: number) => ({ startTime, publishTime, generation });
const r = (forecast: number | null, actual: number | null, leadHours = 20): Row =>
  ({ startMs: 0, forecast, actual, publishMs: null, leadHours, versions: 1 });

describe('deadline + picking rule', () => {
  it('1. deadline is the previous day at HH:MM (UK = UTC in January)', () => {
    expect(new Date(deadlineFor(JAN10, '09:20')).toISOString()).toBe('2026-01-09T09:20:00.000Z');
    expect(new Date(deadlineFor(JAN10, '15:30')).toISOString()).toBe('2026-01-09T15:30:00.000Z');
  });

  it('2. picks the newest version published at or before the deadline', () => {
    const v = [{ publishMs: T('2026-01-09T07:00Z'), mw: 1 }, { publishMs: T('2026-01-09T09:00Z'), mw: 2 }, { publishMs: T('2026-01-09T10:00Z'), mw: 3 }];
    expect(pick(v, deadlineFor(JAN10, '09:20'))?.mw).toBe(2);
  });

  it('3. a version published exactly at the deadline is eligible', () => {
    const v = [{ publishMs: T('2026-01-09T08:00Z'), mw: 1 }, { publishMs: T('2026-01-09T09:20Z'), mw: 9 }];
    expect(pick(v, deadlineFor(JAN10, '09:20'))?.mw).toBe(9);
  });

  it('4. never uses a version published after the deadline (no look-ahead)', () => {
    const v = [{ publishMs: T('2026-01-09T09:21Z'), mw: 5 }];
    expect(pick(v, deadlineFor(JAN10, '09:20'))).toBeNull();
  });

  it('5. order of versions does not matter', () => {
    const v = [{ publishMs: T('2026-01-09T09:00Z'), mw: 2 }, { publishMs: T('2026-01-08T09:00Z'), mw: 1 }];
    expect(pick(v, deadlineFor(JAN10, '09:20'))?.mw).toBe(2);
    expect(pick(undefined, 0)).toBeNull();
  });

  it('6. rowsForDay builds 48 half-hours with forecast gaps left as null', () => {
    const ds = {
      forecasts: new Map([[JAN10, [{ publishMs: T('2026-01-09T09:00Z'), mw: 100 }]]]),
      actuals: new Map([[JAN10, 90], [JAN10 + 1800000, 95]]),
    } as unknown as Dataset;
    const rows = rowsForDay(ds, JAN10, '09:20');
    expect(rows).toHaveLength(48);
    expect(rows[0]).toMatchObject({ forecast: 100, actual: 90, leadHours: 15 });
    expect(rows[1]).toMatchObject({ forecast: null, actual: 95 });
    expect(janDays()).toHaveLength(31);
  });
});

describe('dedupe rules', () => {
  it('7. drops exact duplicate forecast rows', () => {
    const out = dedupeForecasts([row('2026-01-10T00:00:00Z', '2026-01-09T09:00:00Z', 100), row('2026-01-10T00:00:00Z', '2026-01-09T09:00:00Z', 100)]);
    expect(out.dup).toBe(1);
    expect(out.forecasts.get(JAN10)).toHaveLength(1);
  });

  it('8. conflicting forecast values for the same key are flagged and the first is kept', () => {
    const out = dedupeForecasts([row('2026-01-10T00:00:00Z', '2026-01-09T09:00:00Z', 100), row('2026-01-10T00:00:00Z', '2026-01-09T09:00:00Z', 120)]);
    expect(out.conflicts).toBe(1);
    expect(out.forecasts.get(JAN10)![0].mw).toBe(100);
  });

  it('9. forecast rows outside January are trimmed; versions are sorted by publish time', () => {
    const out = dedupeForecasts([
      row('2026-02-01T00:00:00Z', '2026-01-31T09:00:00Z', 1),
      row('2026-01-10T00:00:00Z', '2026-01-09T10:00:00Z', 2),
      row('2026-01-10T00:00:00Z', '2026-01-09T08:00:00Z', 3),
    ]);
    expect(out.feb).toBe(1);
    expect(out.forecasts.get(JAN10)!.map((v) => v.mw)).toEqual([3, 2]);
  });

  it('10. actuals: re-published half-hours keep the latest publish', () => {
    const out = dedupeActuals([
      row('2026-01-10T00:00:00Z', '2026-01-10T01:00:00Z', 50),
      row('2026-01-10T00:00:00Z', '2026-01-10T03:00:00Z', 55),
      row('2026-01-10T00:00:00Z', '2026-01-10T02:00:00Z', 52),
      row('2025-12-31T23:30:00Z', '2026-01-01T00:30:00Z', 1),
    ]);
    expect(out.actuals.get(JAN10)).toBe(55);
    expect(out.multiples).toBe(2);
    expect(out.actuals.size).toBe(1);
  });
});

describe('metrics', () => {
  it('11. MAE, bias (forecast - actual) and P90 nearest-rank only use valid pairs', () => {
    const errs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const rows = [...errs.map((e) => r(100 + e, 100)), r(null, 100), r(100, null)];
    const m = metrics(rows);
    expect(m.validPairs).toBe(10);
    expect(m.mae).toBeCloseTo(5.5);
    expect(m.bias).toBeCloseTo(5.5);
    expect(m.p90).toBe(9); // ceil(0.9*10)=9th smallest
    expect(m.nmae).toBeCloseTo(5.5);
    expect(metrics([r(-5, 0), r(5, 0)]).bias).toBe(0);
    expect(metrics([]).mae).toBeNull();
  });

  it('12. daily energy: forecast is hourly (x 1.0 h), actual is half-hourly (x 0.5 h)', () => {
    expect(forecastMwh([1000, 1000, null])).toBe(2000);
    expect(forecastMwh(Array(24).fill(1000))).toBe(24000);
    expect(actualMwh([1000, 1000, null])).toBe(1000);
    expect(actualMwh(Array(48).fill(1000))).toBe(24000);
    expect(mwh([1000, 1000, null])).toBe(1000);
  });
});
