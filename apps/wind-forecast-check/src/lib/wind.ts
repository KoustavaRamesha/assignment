// Core logic: fetch Elexon data, dedupe, pick forecasts per deadline, compute metrics.
const BASE = 'https://data.elexon.co.uk/bmrs/api/v1/datasets';
const JAN_START = Date.UTC(2026, 0, 1);
const FEB_START = Date.UTC(2026, 1, 1);
const FORECAST_FETCH_START = Date.UTC(2025, 11, 20); // well before max lead time; checked below
const HH = 30 * 60 * 1000;
export const PRESETS = ['09:20', '09:50', '15:30'];

export type Raw = { publishTime: string; startTime: string; generation: number };
export type Version = { publishMs: number; mw: number };

export type Dataset = {
  forecasts: Map<number, Version[]>; // startMs -> versions (sorted by publish)
  actuals: Map<number, number>;
  stats: {
    forecastRowsFetched: number;
    forecastRowsKept: number;
    exactDuplicatesDropped: number;
    conflictsFlagged: number;
    conflictExamples: string[];
    februaryTrimmed: number;
    actualRowsFetched: number;
    actualMultiples: number;
    maxLeadHours: number;
    earliestEligibleForJan1: string | null;
    windowOk: boolean;
    publishHoursUtc: { time: string; count: number }[];
  };
};

async function getJson(url: string): Promise<Raw[]> {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`Elexon ${res.status} for ${url}`);
  const body = await res.json();
  return Array.isArray(body) ? body : body.data ?? [];
}

function chunks(from: number, to: number, days: number) {
  const out: [string, string][] = [];
  for (let t = from; t < to; t += days * 86400000) {
    const end = Math.min(t + days * 86400000, to);
    out.push([new Date(t).toISOString(), new Date(end).toISOString()]);
  }
  return out;
}

let cache: Promise<Dataset> | null = null;
export function loadDataset() {
  if (!cache) cache = build().catch((e) => { cache = null; throw e; });
  return cache;
}

// Forecast dedupe rules (pure, unit-tested):
// - keep only delivery starts inside January 2026 (February rows counted as trimmed)
// - key = startTime + publishTime; identical repeats dropped, conflicting values flagged and the FIRST seen kept
export function dedupeForecasts(fcRows: Raw[]) {
  const byKey = new Map<string, Raw>();
  let dup = 0, conflicts = 0, feb = 0, maxLead = 0;
  const conflictExamples: string[] = [];
  const pubCounts = new Map<string, Set<string>>();
  for (const r of fcRows) {
    const s = Date.parse(r.startTime), p = Date.parse(r.publishTime);
    if (s < JAN_START || s >= FEB_START) { if (s >= FEB_START) feb++; continue; }
    maxLead = Math.max(maxLead, (s - p) / 3600000);
    const key = `${s}|${p}`;
    const prev = byKey.get(key);
    if (prev) {
      if (prev.generation === r.generation) dup++;
      else { conflicts++; if (conflictExamples.length < 5) conflictExamples.push(`${r.startTime} @ ${r.publishTime}: ${prev.generation} vs ${r.generation} (kept first)`); }
      continue;
    }
    byKey.set(key, r);
    const hm = r.publishTime.slice(11, 16);
    if (!pubCounts.has(hm)) pubCounts.set(hm, new Set());
    pubCounts.get(hm)!.add(r.publishTime.slice(0, 10));
  }
  const forecasts = new Map<number, Version[]>();
  for (const r of byKey.values()) {
    const s = Date.parse(r.startTime);
    if (!forecasts.has(s)) forecasts.set(s, []);
    forecasts.get(s)!.push({ publishMs: Date.parse(r.publishTime), mw: r.generation });
  }
  forecasts.forEach((v) => v.sort((a, b) => a.publishMs - b.publishMs));
  return { forecasts, byKeySize: byKey.size, dup, conflicts, conflictExamples, feb, maxLead, pubCounts };
}

// Actual dedupe rule: one value per January half-hour; when Elexon re-publishes, keep the LATEST publishTime.
export function dedupeActuals(actRows: Raw[]) {
  const actPub = new Map<number, number>();
  const actuals = new Map<number, number>();
  let multiples = 0;
  for (const r of actRows) {
    const s = Date.parse(r.startTime);
    if (s < JAN_START || s >= FEB_START) continue;
    const p = Date.parse(r.publishTime);
    if (actuals.has(s)) { multiples++; if (p <= actPub.get(s)!) continue; }
    actuals.set(s, r.generation); actPub.set(s, p);
  }
  return { actuals, multiples };
}

async function build(): Promise<Dataset> {
  const fcChunks = chunks(FORECAST_FETCH_START, FEB_START, 7);
  const fcRows = (await Promise.all(fcChunks.map(([a, b]) =>
    getJson(`${BASE}/WINDFOR/stream?publishDateTimeFrom=${a}&publishDateTimeTo=${b}`)))).flat();
  const actRows = (await Promise.all(chunks(JAN_START - 86400000, FEB_START + 86400000, 7).map(([a, b]) =>
    getJson(`${BASE}/FUELHH/stream?settlementDateFrom=${a.slice(0, 10)}&settlementDateTo=${b.slice(0, 10)}&fuelType=WIND`)))).flat();

  const fc = dedupeForecasts(fcRows);
  const act = dedupeActuals(actRows);
  const { forecasts, byKeySize, dup, conflicts, conflictExamples, feb, maxLead, pubCounts } = fc;
  const { actuals, multiples } = act;
  const byKey = { size: byKeySize };

  const jan1 = forecasts.get(JAN_START) ?? [];
  const earliest = jan1[0]?.publishMs;
  return {
    forecasts, actuals,
    stats: {
      forecastRowsFetched: fcRows.length,
      forecastRowsKept: byKey.size,
      exactDuplicatesDropped: dup,
      conflictsFlagged: conflicts,
      conflictExamples,
      februaryTrimmed: feb,
      actualRowsFetched: actRows.length,
      actualMultiples: multiples,
      maxLeadHours: Math.round(maxLead * 10) / 10,
      earliestEligibleForJan1: earliest ? new Date(earliest).toISOString() : null,
      // window check: fetch start must precede Jan1 minus max lead
      windowOk: FORECAST_FETCH_START < JAN_START - maxLead * 3600000,
      publishHoursUtc: [...pubCounts.entries()].map(([time, d]) => ({ time, count: d.size })).sort((a, b) => a.time.localeCompare(b.time)),
    },
  };
}

// Deadline for delivery day = previous day at HH:MM UK time (= UTC in January).
export function deadlineFor(dayMs: number, hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return dayMs - 86400000 + (h * 60 + m) * 60000;
}

export function pick(versions: Version[] | undefined, deadlineMs: number) {
  let best: Version | null = null;
  for (const v of versions ?? []) if (v.publishMs <= deadlineMs && (!best || v.publishMs > best.publishMs)) best = v;
  return best;
}

export type Row = { startMs: number; forecast: number | null; actual: number | null; publishMs: number | null; leadHours: number | null; versions: number };

export function rowsForDay(ds: Dataset, dayMs: number, hhmm: string): Row[] {
  const dl = deadlineFor(dayMs, hhmm);
  const rows: Row[] = [];
  for (let i = 0; i < 48; i++) {
    const s = dayMs + i * HH;
    const p = pick(ds.forecasts.get(s), dl);
    rows.push({
      startMs: s, forecast: p?.mw ?? null, actual: ds.actuals.get(s) ?? null,
      publishMs: p?.publishMs ?? null, leadHours: p ? (s - p.publishMs) / 3600000 : null,
      versions: ds.forecasts.get(s)?.length ?? 0,
    });
  }
  return rows;
}

export const janDays = () => Array.from({ length: 31 }, (_, i) => JAN_START + i * 86400000);

export function metrics(rows: Row[]) {
  const pairs = rows.filter((r) => r.forecast != null && r.actual != null);
  const errs = pairs.map((r) => r.forecast! - r.actual!);
  const abs = errs.map(Math.abs).sort((a, b) => a - b);
  const n = pairs.length;
  const mae = n ? abs.reduce((a, b) => a + b, 0) / n : null;
  const bias = n ? errs.reduce((a, b) => a + b, 0) / n : null;
  // P90: nearest-rank method
  const p90 = n ? abs[Math.ceil(0.9 * n) - 1] : null;
  const meanActual = n ? pairs.reduce((a, r) => a + r.actual!, 0) / n : null;
  const nmae = mae != null && meanActual ? (mae / meanActual) * 100 : null;
  const avgLead = n ? pairs.reduce((a, r) => a + r.leadHours!, 0) / n : null;
  return { mae, bias, p90, nmae, validPairs: n, meanActual, avgLead };
}

export const forecastMwh = (vals: (number | null)[]) => vals.reduce<number>((a, v) => a + (v ?? 0), 0) * 1.0;
export const actualMwh = (vals: (number | null)[]) => vals.reduce<number>((a, v) => a + (v ?? 0), 0) * 0.5;
export const mwh = actualMwh;
