"""
Core wind forecast analysis logic for GB wind, January 2026.
Fetches WINDFOR (forecasts) and FUELHH (actuals) from Elexon BMRS,
deduplicates, applies deadline-based picking, and computes accuracy metrics.
"""

import asyncio
import math
from datetime import datetime, timezone
from typing import Optional

import httpx

BASE = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
JAN_START = datetime(2026, 1, 1, tzinfo=timezone.utc)
FEB_START = datetime(2026, 2, 1, tzinfo=timezone.utc)
FORECAST_FETCH_START = datetime(2025, 12, 20, tzinfo=timezone.utc)

JAN_START_MS = int(JAN_START.timestamp() * 1000)
FEB_START_MS = int(FEB_START.timestamp() * 1000)
FORECAST_FETCH_START_MS = int(FORECAST_FETCH_START.timestamp() * 1000)
HH_MS = 30 * 60 * 1000  # half-hour in milliseconds

PRESETS = ["09:20", "09:50", "15:30"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ms(iso: str) -> int:
    """Parse ISO 8601 string to epoch milliseconds."""
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return int(dt.timestamp() * 1000)


def _iso(ms: int) -> str:
    """Epoch milliseconds to ISO 8601 string."""
    return (
        datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
        .strftime("%Y-%m-%dT%H:%M:%S.000Z")
    )


def _chunks(from_ms: int, to_ms: int, days: int) -> list[tuple[str, str]]:
    """Split a time range into day-sized ISO chunks for Elexon queries."""
    out: list[tuple[str, str]] = []
    day_ms = days * 86_400_000
    t = from_ms
    while t < to_ms:
        end = min(t + day_ms, to_ms)
        out.append((_iso(t), _iso(end)))
        t = end
    return out


# ---------------------------------------------------------------------------
# Elexon data fetching
# ---------------------------------------------------------------------------

async def _get_json(client: httpx.AsyncClient, url: str) -> list[dict]:
    """Fetch JSON from an Elexon BMRS endpoint."""
    resp = await client.get(url, headers={"accept": "application/json"}, timeout=60)
    resp.raise_for_status()
    body = resp.json()
    if isinstance(body, list):
        return body
    return body.get("data", [])


# ---------------------------------------------------------------------------
# Deduplication (pure functions, unit-testable)
# ---------------------------------------------------------------------------

def dedupe_forecasts(fc_rows: list[dict]) -> dict:
    """
    Forecast dedupe rules:
    - keep only delivery starts inside January 2026
    - key = startTime + publishTime
    - identical repeats → dropped
    - conflicting values → flagged, first seen kept
    """
    by_key: dict[str, dict] = {}
    dup = 0
    conflicts = 0
    feb = 0
    max_lead = 0.0
    conflict_examples: list[str] = []
    pub_counts: dict[str, set[str]] = {}

    for r in fc_rows:
        s = _ms(r["startTime"])
        p = _ms(r["publishTime"])
        if s < JAN_START_MS or s >= FEB_START_MS:
            if s >= FEB_START_MS:
                feb += 1
            continue
        max_lead = max(max_lead, (s - p) / 3_600_000)
        key = f"{s}|{p}"
        prev = by_key.get(key)
        if prev is not None:
            if prev["generation"] == r["generation"]:
                dup += 1
            else:
                conflicts += 1
                if len(conflict_examples) < 5:
                    conflict_examples.append(
                        f"{r['startTime']} @ {r['publishTime']}: "
                        f"{prev['generation']} vs {r['generation']} (kept first)"
                    )
            continue
        by_key[key] = r
        hm = r["publishTime"][11:16]
        if hm not in pub_counts:
            pub_counts[hm] = set()
        pub_counts[hm].add(r["publishTime"][:10])

    # Build forecasts map: startMs -> list of {publishMs, mw}
    forecasts: dict[int, list[dict]] = {}
    for r in by_key.values():
        s = _ms(r["startTime"])
        if s not in forecasts:
            forecasts[s] = []
        forecasts[s].append({"publishMs": _ms(r["publishTime"]), "mw": r["generation"]})

    for versions in forecasts.values():
        versions.sort(key=lambda v: v["publishMs"])

    return {
        "forecasts": forecasts,
        "byKeySize": len(by_key),
        "dup": dup,
        "conflicts": conflicts,
        "conflictExamples": conflict_examples,
        "feb": feb,
        "maxLead": max_lead,
        "pubCounts": pub_counts,
    }


def dedupe_actuals(act_rows: list[dict]) -> dict:
    """
    Actual dedupe rule:
    One value per January half-hour; when Elexon re-publishes, keep the
    LATEST publishTime.
    """
    act_pub: dict[int, int] = {}
    actuals: dict[int, float] = {}
    multiples = 0

    for r in act_rows:
        s = _ms(r["startTime"])
        if s < JAN_START_MS or s >= FEB_START_MS:
            continue
        p = _ms(r["publishTime"])
        if s in actuals:
            multiples += 1
            if p <= act_pub[s]:
                continue
        actuals[s] = r["generation"]
        act_pub[s] = p

    return {"actuals": actuals, "multiples": multiples}


# ---------------------------------------------------------------------------
# Dataset builder (cached in-memory)
# ---------------------------------------------------------------------------

_dataset_cache: Optional[dict] = None
_dataset_lock = asyncio.Lock()


async def load_dataset() -> dict:
    """Build or return cached dataset."""
    global _dataset_cache
    if _dataset_cache is not None:
        return _dataset_cache

    async with _dataset_lock:
        if _dataset_cache is not None:
            return _dataset_cache
        _dataset_cache = await _build_dataset()
        return _dataset_cache


async def _build_dataset() -> dict:
    fc_chunks = _chunks(FORECAST_FETCH_START_MS, FEB_START_MS, 7)
    act_chunks = _chunks(JAN_START_MS - 86_400_000, FEB_START_MS + 86_400_000, 7)

    async with httpx.AsyncClient() as client:
        fc_tasks = [
            _get_json(
                client,
                f"{BASE}/WINDFOR/stream?publishDateTimeFrom={a}&publishDateTimeTo={b}",
            )
            for a, b in fc_chunks
        ]
        act_tasks = [
            _get_json(
                client,
                f"{BASE}/FUELHH/stream?settlementDateFrom={a[:10]}"
                f"&settlementDateTo={b[:10]}&fuelType=WIND",
            )
            for a, b in act_chunks
        ]
        fc_results = await asyncio.gather(*fc_tasks)
        act_results = await asyncio.gather(*act_tasks)

    fc_rows = [r for chunk in fc_results for r in chunk]
    act_rows = [r for chunk in act_results for r in chunk]

    fc = dedupe_forecasts(fc_rows)
    act = dedupe_actuals(act_rows)

    forecasts = fc["forecasts"]
    actuals = act["actuals"]

    jan1_versions = forecasts.get(JAN_START_MS, [])
    earliest = jan1_versions[0]["publishMs"] if jan1_versions else None

    return {
        "forecasts": forecasts,
        "actuals": actuals,
        "stats": {
            "forecastRowsFetched": len(fc_rows),
            "forecastRowsKept": fc["byKeySize"],
            "exactDuplicatesDropped": fc["dup"],
            "conflictsFlagged": fc["conflicts"],
            "conflictExamples": fc["conflictExamples"],
            "februaryTrimmed": fc["feb"],
            "actualRowsFetched": len(act_rows),
            "actualMultiples": act["multiples"],
            "maxLeadHours": round(fc["maxLead"] * 10) / 10,
            "earliestEligibleForJan1": _iso(earliest) if earliest else None,
            "windowOk": FORECAST_FETCH_START_MS
            < JAN_START_MS - fc["maxLead"] * 3_600_000,
            "publishHoursUtc": sorted(
                [{"time": t, "count": len(d)} for t, d in fc["pubCounts"].items()],
                key=lambda x: x["time"],
            ),
        },
    }


# ---------------------------------------------------------------------------
# Deadline & picking
# ---------------------------------------------------------------------------

def deadline_for(day_ms: int, hhmm: str) -> int:
    """Deadline for delivery day = previous day at HH:MM UTC (= UK in Jan)."""
    h, m = map(int, hhmm.split(":"))
    return day_ms - 86_400_000 + (h * 60 + m) * 60_000


def pick(versions: Optional[list[dict]], deadline_ms: int) -> Optional[dict]:
    """Pick the newest forecast version published at or before the deadline."""
    best = None
    for v in versions or []:
        if v["publishMs"] <= deadline_ms and (
            best is None or v["publishMs"] > best["publishMs"]
        ):
            best = v
    return best


# ---------------------------------------------------------------------------
# Row building
# ---------------------------------------------------------------------------

def rows_for_day(ds: dict, day_ms: int, hhmm: str) -> list[dict]:
    """Build 48 half-hour rows for one delivery day with forecast + actual."""
    dl = deadline_for(day_ms, hhmm)
    rows = []
    for i in range(48):
        s = day_ms + i * HH_MS
        versions = ds["forecasts"].get(s)
        p = pick(versions, dl)
        rows.append(
            {
                "startMs": s,
                "forecast": p["mw"] if p else None,
                "actual": ds["actuals"].get(s),
                "publishMs": p["publishMs"] if p else None,
                "leadHours": (s - p["publishMs"]) / 3_600_000 if p else None,
                "versions": len(versions) if versions else 0,
            }
        )
    return rows


def jan_days() -> list[int]:
    """Return epoch-ms timestamps for each of the 31 January days."""
    return [JAN_START_MS + i * 86_400_000 for i in range(31)]


# ---------------------------------------------------------------------------
# Energy calculations — FIXED: forecasts are hourly, actuals are half-hourly
# ---------------------------------------------------------------------------

def forecast_mwh(vals: list) -> float:
    """
    Forecast energy: forecasts are published hourly (one value per hour),
    so each non-null MW value covers 1 hour.
    """
    return sum(v for v in vals if v is not None) * 1.0


def actual_mwh(vals: list) -> float:
    """
    Actual energy: actuals are half-hourly (one value per 30 min),
    so each MW value covers 0.5 hours.
    """
    return sum(v for v in vals if v is not None) * 0.5


# ---------------------------------------------------------------------------
# Accuracy metrics
# ---------------------------------------------------------------------------

def metrics(rows: list[dict]) -> dict:
    """Compute MAE, bias, P90, nMAE, avg lead time from matched pairs."""
    pairs = [
        r for r in rows if r["forecast"] is not None and r["actual"] is not None
    ]
    n = len(pairs)
    if not n:
        return {
            "mae": None,
            "bias": None,
            "p90": None,
            "nmae": None,
            "validPairs": 0,
            "meanActual": None,
            "avgLead": None,
        }

    errs = [r["forecast"] - r["actual"] for r in pairs]
    abs_errs = sorted(abs(e) for e in errs)
    mae = sum(abs_errs) / n
    bias = sum(errs) / n
    # P90: nearest-rank method (no interpolation)
    p90 = abs_errs[math.ceil(0.9 * n) - 1]
    mean_actual = sum(r["actual"] for r in pairs) / n
    nmae = (mae / mean_actual) * 100 if mean_actual else None
    avg_lead = sum(r["leadHours"] for r in pairs) / n

    return {
        "mae": mae,
        "bias": bias,
        "p90": p90,
        "nmae": nmae,
        "validPairs": n,
        "meanActual": mean_actual,
        "avgLead": avg_lead,
    }
