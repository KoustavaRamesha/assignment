// Data client used by every page.
// - Connects to the Python FastAPI backend (/api/*).
// - Gracefully falls back to browser-side calculation if the backend is offline
//   or running in standalone static mode (zero config).

export interface GetDayInputType {
  day: number;
  deadline: string;
}

export interface DayRow {
  startTime: string;
  forecast: number | null;
  actual: number | null;
  publishTime: string | null;
  leadHours: number | null;
}

export interface GetDayOutputType {
  rows: DayRow[];
  publishTimesUsed: string[];
  forecastMwh: number;
  actualMwh: number;
  minForecast: { time: string; mw: number } | null;
  maxForecast: { time: string; mw: number } | null;
  missing: number;
  sameAsPresets: string[];
  mae: number | null;
}

export interface GetAccuracyInputType {
  deadline: string;
}

export interface GetAccuracyOutputType {
  overall: {
    mae: number | null;
    bias: number | null;
    p90: number | null;
    nmae: number | null;
    validPairs: number;
    meanActual: number | null;
    avgLead: number | null;
  };
  byDay: { day: number; mae: number | null; validPairs: number }[];
  byHour: { hour: number; mae: number | null; avgLead: number | null; validPairs: number }[];
  expected: number;
}

export interface GetCoverageInputType {
  deadline: string;
}

export interface GetCoverageOutputType {
  expected: number;
  actualsFound: number;
  forecastRowsFetched: number;
  forecastRowsKept: number;
  exactDuplicatesDropped: number;
  conflictsFlagged: number;
  conflictExamples: string[];
  februaryTrimmed: number;
  actualMultiples: number;
  halfHoursWithAnyForecast: number;
  matchedPairs: number;
  noEligibleForecast: number;
  missing: number;
  coveragePct: number;
  maxLeadHours: number;
  earliestEligibleForJan1: string | null;
  windowOk: boolean;
  publishHoursUtc: { time: string; count: number }[];
}

export interface GetVersionsInputType {
  day: number;
  slot: number;
  deadline: string;
}

export interface GetVersionsOutputType {
  startTime: string;
  deadline: string;
  actual: number | null;
  versions: {
    publishTime: string;
    mw: number;
    leadHours: number;
    eligible: boolean;
    picked: boolean;
  }[];
}

const API_BASE = import.meta.env.VITE_API_URL || '';

// Fallback executor using in-browser calculation
type Ep<I, O> = { default: { execute: (a: { input: I; context: unknown }) => Promise<O> } };
async function runLocal<I, O>(loader: () => Promise<Ep<I, O>>, input: I): Promise<O> {
  const mod = await loader();
  return mod.default.execute({ input, context: {} });
}

export async function getDay(input: GetDayInputType): Promise<GetDayOutputType> {
  try {
    const res = await fetch(`${API_BASE}/api/day?day=${input.day}&deadline=${encodeURIComponent(input.deadline)}`);
    if (res.ok) return await res.json();
  } catch {
    // fallback to local calculation
  }
  return runLocal<GetDayInputType, GetDayOutputType>(() => import('../api/getDay'), input);
}

export async function getAccuracy(input: GetAccuracyInputType): Promise<GetAccuracyOutputType> {
  try {
    const res = await fetch(`${API_BASE}/api/accuracy?deadline=${encodeURIComponent(input.deadline)}`);
    if (res.ok) return await res.json();
  } catch {
    // fallback to local calculation
  }
  return runLocal<GetAccuracyInputType, GetAccuracyOutputType>(() => import('../api/getAccuracy'), input);
}

export async function getCoverage(input: GetCoverageInputType): Promise<GetCoverageOutputType> {
  try {
    const res = await fetch(`${API_BASE}/api/coverage?deadline=${encodeURIComponent(input.deadline)}`);
    if (res.ok) return await res.json();
  } catch {
    // fallback to local calculation
  }
  return runLocal<GetCoverageInputType, GetCoverageOutputType>(() => import('../api/getCoverage'), input);
}

export async function getVersions(input: GetVersionsInputType): Promise<GetVersionsOutputType> {
  try {
    const res = await fetch(`${API_BASE}/api/versions?day=${input.day}&slot=${input.slot}&deadline=${encodeURIComponent(input.deadline)}`);
    if (res.ok) return await res.json();
  } catch {
    // fallback to local calculation
  }
  return runLocal<GetVersionsInputType, GetVersionsOutputType>(() => import('../api/getVersions'), input);
}
