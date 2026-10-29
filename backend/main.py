"""
FastAPI backend for Wind Forecast Check.
Serves REST API endpoints consumed by the React frontend.
Fetches data from Elexon BMRS, deduplicates, and computes metrics.
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from wind import (
    PRESETS,
    actual_mwh,
    deadline_for,
    forecast_mwh,
    jan_days,
    load_dataset,
    metrics,
    pick,
    rows_for_day,
)


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Optionally pre-load dataset on startup."""
    yield


app = FastAPI(
    title="Wind Forecast Check API",
    description="GB wind forecast vs actual analysis, January 2026",
    lifespan=lifespan,
)

# CORS — allow the Vite dev server and any deployed frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _iso(ms: int) -> str:
    from datetime import datetime, timezone
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime(
        "%Y-%m-%dT%H:%M:%S.000Z"
    )


def _day_ms(day: int) -> int:
    from datetime import datetime, timezone
    return int(datetime(2026, 1, day, tzinfo=timezone.utc).timestamp() * 1000)


# ---------------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------------

@app.get("/api/day")
async def get_day(day: int = Query(ge=1, le=31), deadline: str = Query(default="09:20")):
    """Forecast vs actual wind for one January 2026 delivery day."""
    ds = await load_dataset()
    day_ms = _day_ms(day)
    rows = rows_for_day(ds, day_ms, deadline)

    # Signature check: do other presets pick the same forecasts?
    sig = lambda r: ",".join(str(x["publishMs"]) if x["publishMs"] else "x" for x in r)
    mine = sig(rows)
    same_as_presets = [
        p for p in PRESETS
        if p != deadline and sig(rows_for_day(ds, day_ms, p)) == mine
    ]

    with_f = [r for r in rows if r["forecast"] is not None]
    sorted_f = sorted(with_f, key=lambda r: r["forecast"])

    return {
        "rows": [
            {
                "startTime": _iso(r["startMs"]),
                "forecast": r["forecast"],
                "actual": r["actual"],
                "publishTime": _iso(r["publishMs"]) if r["publishMs"] else None,
                "leadHours": r["leadHours"],
            }
            for r in rows
        ],
        "publishTimesUsed": sorted(
            set(_iso(r["publishMs"]) for r in with_f if r["publishMs"])
        ),
        "forecastMwh": forecast_mwh([r["forecast"] for r in rows]),
        "actualMwh": actual_mwh([r["actual"] for r in rows]),
        "minForecast": (
            {"time": _iso(sorted_f[0]["startMs"]), "mw": sorted_f[0]["forecast"]}
            if sorted_f
            else None
        ),
        "maxForecast": (
            {"time": _iso(sorted_f[-1]["startMs"]), "mw": sorted_f[-1]["forecast"]}
            if sorted_f
            else None
        ),
        "missing": sum(
            1 for r in rows if r["forecast"] is None or r["actual"] is None
        ),
        "sameAsPresets": same_as_presets,
        "mae": metrics(rows)["mae"],
    }


@app.get("/api/accuracy")
async def get_accuracy(deadline: str = Query(default="09:20")):
    """January look-back accuracy metrics for a chosen deadline."""
    ds = await load_dataset()
    all_rows = []
    by_day = []
    for i, d in enumerate(jan_days()):
        rows = rows_for_day(ds, d, deadline)
        all_rows.extend(rows)
        mm = metrics(rows)
        by_day.append({"day": i + 1, "mae": mm["mae"], "validPairs": mm["validPairs"]})

    by_hour = []
    for h in range(24):
        hour_rows = [r for r in all_rows if (_iso(r["startMs"])[11:13] == f"{h:02d}")]
        mm = metrics(hour_rows)
        by_hour.append(
            {
                "hour": h,
                "mae": mm["mae"],
                "avgLead": mm["avgLead"],
                "validPairs": mm["validPairs"],
            }
        )

    return {
        "overall": metrics(all_rows),
        "byDay": by_day,
        "byHour": by_hour,
        "expected": len(all_rows),
    }


@app.get("/api/coverage")
async def get_coverage(deadline: str = Query(default="09:20")):
    """Data coverage and quality report for January 2026."""
    ds = await load_dataset()
    rows = []
    for d in jan_days():
        rows.extend(rows_for_day(ds, d, deadline))

    matched = sum(
        1 for r in rows if r["forecast"] is not None and r["actual"] is not None
    )
    s = ds["stats"]

    return {
        "expected": len(rows),
        "actualsFound": len(ds["actuals"]),
        "forecastRowsFetched": s["forecastRowsFetched"],
        "forecastRowsKept": s["forecastRowsKept"],
        "exactDuplicatesDropped": s["exactDuplicatesDropped"],
        "conflictsFlagged": s["conflictsFlagged"],
        "conflictExamples": s["conflictExamples"],
        "februaryTrimmed": s["februaryTrimmed"],
        "actualMultiples": s["actualMultiples"],
        "halfHoursWithAnyForecast": sum(1 for r in rows if r["versions"] > 0),
        "matchedPairs": matched,
        "noEligibleForecast": sum(1 for r in rows if r["forecast"] is None),
        "missing": len(rows) - matched,
        "coveragePct": (matched / len(rows)) * 100 if rows else 0,
        "maxLeadHours": s["maxLeadHours"],
        "earliestEligibleForJan1": s["earliestEligibleForJan1"],
        "windowOk": s["windowOk"],
        "publishHoursUtc": s["publishHoursUtc"],
    }


@app.get("/api/versions")
async def get_versions(
    day: int = Query(ge=1, le=31),
    slot: int = Query(ge=0, le=47),
    deadline: str = Query(default="09:20"),
):
    """Proof view: every forecast version for one half-hour slot."""
    ds = await load_dataset()
    day_ms = _day_ms(day)
    s = day_ms + slot * 1_800_000
    dl = deadline_for(day_ms, deadline)
    vs = ds["forecasts"].get(s, [])
    p = pick(vs, dl)

    return {
        "startTime": _iso(s),
        "deadline": _iso(dl),
        "actual": ds["actuals"].get(s),
        "versions": [
            {
                "publishTime": _iso(v["publishMs"]),
                "mw": v["mw"],
                "leadHours": (s - v["publishMs"]) / 3_600_000,
                "eligible": v["publishMs"] <= dl,
                "picked": v is p,
            }
            for v in vs
        ],
    }


# ---------------------------------------------------------------------------
# Serve static frontend in production (Docker)
# ---------------------------------------------------------------------------

STATIC_DIR = os.environ.get("STATIC_DIR")
if STATIC_DIR and os.path.isdir(STATIC_DIR):
    # Serve the built React app as static files (catch-all for SPA routing)
    from fastapi.responses import FileResponse

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        import os.path
        file_path = os.path.join(STATIC_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
