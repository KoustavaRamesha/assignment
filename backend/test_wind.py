"""
Unit tests for the Python wind analysis module.
Mirrors the 12 TypeScript tests from tests/wind.test.ts.
"""

import math
import sys
import os
import pytest

# Ensure backend directory is on sys.path
sys.path.insert(0, os.path.dirname(__file__))

from wind import (
    deadline_for,
    pick,
    rows_for_day,
    metrics,
    forecast_mwh,
    actual_mwh,
    dedupe_forecasts,
    dedupe_actuals,
    jan_days,
)

def _ms(iso: str) -> int:
    from datetime import datetime, timezone
    return int(datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp() * 1000)

JAN10_MS = _ms("2026-01-10T00:00:00Z")


def _row(start_time: str, publish_time: str, generation: float) -> dict:
    return {"startTime": start_time, "publishTime": publish_time, "generation": generation}


def _r(forecast, actual, lead_hours=20) -> dict:
    return {
        "startMs": 0,
        "forecast": forecast,
        "actual": actual,
        "publishMs": None,
        "leadHours": lead_hours,
        "versions": 1,
    }


# ── Deadline + picking rule ──────────────────────────────────────────────


class TestDeadlinePicking:
    def test_1_deadline_is_previous_day(self):
        assert deadline_for(JAN10_MS, "09:20") == _ms("2026-01-09T09:20:00Z")
        assert deadline_for(JAN10_MS, "15:30") == _ms("2026-01-09T15:30:00Z")

    def test_2_picks_newest_before_deadline(self):
        v = [
            {"publishMs": _ms("2026-01-09T07:00Z"), "mw": 1},
            {"publishMs": _ms("2026-01-09T09:00Z"), "mw": 2},
            {"publishMs": _ms("2026-01-09T10:00Z"), "mw": 3},
        ]
        assert pick(v, deadline_for(JAN10_MS, "09:20"))["mw"] == 2

    def test_3_exactly_at_deadline_is_eligible(self):
        v = [
            {"publishMs": _ms("2026-01-09T08:00Z"), "mw": 1},
            {"publishMs": _ms("2026-01-09T09:20Z"), "mw": 9},
        ]
        assert pick(v, deadline_for(JAN10_MS, "09:20"))["mw"] == 9

    def test_4_never_uses_version_after_deadline(self):
        v = [{"publishMs": _ms("2026-01-09T09:21Z"), "mw": 5}]
        assert pick(v, deadline_for(JAN10_MS, "09:20")) is None

    def test_5_order_does_not_matter(self):
        v = [
            {"publishMs": _ms("2026-01-09T09:00Z"), "mw": 2},
            {"publishMs": _ms("2026-01-08T09:00Z"), "mw": 1},
        ]
        assert pick(v, deadline_for(JAN10_MS, "09:20"))["mw"] == 2
        assert pick(None, 0) is None

    def test_6_rows_for_day_builds_48(self):
        ds = {
            "forecasts": {
                JAN10_MS: [{"publishMs": _ms("2026-01-09T09:00Z"), "mw": 100}]
            },
            "actuals": {JAN10_MS: 90, JAN10_MS + 1_800_000: 95},
        }
        rows = rows_for_day(ds, JAN10_MS, "09:20")
        assert len(rows) == 48
        assert rows[0]["forecast"] == 100
        assert rows[0]["actual"] == 90
        assert rows[0]["leadHours"] == 15
        assert rows[1]["forecast"] is None
        assert rows[1]["actual"] == 95
        assert len(jan_days()) == 31


# ── Dedupe rules ─────────────────────────────────────────────────────────


class TestDedupe:
    def test_7_drops_exact_duplicate_forecasts(self):
        out = dedupe_forecasts([
            _row("2026-01-10T00:00:00Z", "2026-01-09T09:00:00Z", 100),
            _row("2026-01-10T00:00:00Z", "2026-01-09T09:00:00Z", 100),
        ])
        assert out["dup"] == 1
        assert len(out["forecasts"][JAN10_MS]) == 1

    def test_8_conflicts_flagged_first_kept(self):
        out = dedupe_forecasts([
            _row("2026-01-10T00:00:00Z", "2026-01-09T09:00:00Z", 100),
            _row("2026-01-10T00:00:00Z", "2026-01-09T09:00:00Z", 120),
        ])
        assert out["conflicts"] == 1
        assert out["forecasts"][JAN10_MS][0]["mw"] == 100

    def test_9_february_trimmed_versions_sorted(self):
        out = dedupe_forecasts([
            _row("2026-02-01T00:00:00Z", "2026-01-31T09:00:00Z", 1),
            _row("2026-01-10T00:00:00Z", "2026-01-09T10:00:00Z", 2),
            _row("2026-01-10T00:00:00Z", "2026-01-09T08:00:00Z", 3),
        ])
        assert out["feb"] == 1
        assert [v["mw"] for v in out["forecasts"][JAN10_MS]] == [3, 2]

    def test_10_actuals_keep_latest_publish(self):
        out = dedupe_actuals([
            _row("2026-01-10T00:00:00Z", "2026-01-10T01:00:00Z", 50),
            _row("2026-01-10T00:00:00Z", "2026-01-10T03:00:00Z", 55),
            _row("2026-01-10T00:00:00Z", "2026-01-10T02:00:00Z", 52),
            _row("2025-12-31T23:30:00Z", "2026-01-01T00:30:00Z", 1),
        ])
        assert out["actuals"][JAN10_MS] == 55
        assert out["multiples"] == 2
        assert len(out["actuals"]) == 1


# ── Metrics ──────────────────────────────────────────────────────────────


class TestMetrics:
    def test_11_mae_bias_p90(self):
        errs = list(range(1, 11))
        rows = [_r(100 + e, 100) for e in errs] + [_r(None, 100), _r(100, None)]
        m = metrics(rows)
        assert m["validPairs"] == 10
        assert abs(m["mae"] - 5.5) < 0.01
        assert abs(m["bias"] - 5.5) < 0.01
        assert m["p90"] == 9
        assert abs(m["nmae"] - 5.5) < 0.01
        assert metrics([_r(-5, 0), _r(5, 0)])["bias"] == 0
        assert metrics([])["mae"] is None

    def test_12_energy_calculations(self):
        """
        FIXED: forecast energy uses ×1h (forecasts are hourly),
        actual energy uses ×0.5h (actuals are half-hourly).
        """
        # Forecast: 24 hourly MW values of 1000 = 24,000 MWh
        assert forecast_mwh([1000] * 24) == 24_000
        # Actual: 48 half-hourly MW values of 1000 = 24,000 MWh
        assert actual_mwh([1000] * 48) == 24_000
        # Nulls are treated as zero
        assert forecast_mwh([1000, 1000, None]) == 2000
        assert actual_mwh([1000, 1000, None]) == 1000
