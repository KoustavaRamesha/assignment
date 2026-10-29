# Wind Forecast Check

A public website for a GB power buyer. For January 2026 it shows the wind forecast they actually had at their decision deadline (09:20 UK the day before by default, with 09:50 and 15:30 presets) next to what really happened. It also has a look-back page showing how far off those forecasts were, a proof page that shows how a forecast version was picked, and a data coverage report. Data comes live from Elexon BMRS.

## Pages

- **Forecast** — the forecast at the chosen decision deadline for a delivery day, next to actuals.
- **Accuracy** — look-back of how far the day-before forecasts were for the whole month (MAE, RMSE, bias, P90).
- **Proof** — for any hour, which published forecast version existed at the deadline and which one was used.
- **Coverage** — data coverage report for the underlying BMRS feeds.
- **Report** — the full January 2026 write-up with charts, worst days, deadline comparison and recommendations.

## Data source

[Elexon BMRS](https://www.bmreports.com): WINDFOR forecasts, FUELHH actuals (wind only), plus demand and price feeds. Times are UTC, which equals UK time in January. Backend endpoints live in `src/api/`.

## Running locally

Dependencies are managed with [Bun](https://bun.sh) (Node ≥ 20 also works).

```sh
bun install
bun run dev        # dev server on http://localhost:8080
bun run build      # production build (tsc + vite build)
bun run typecheck  # TypeScript check
```

## Stack

Vite + React 18 + TypeScript, Tailwind CSS with a small in-house UI kit (`src/components/ui`), Recharts for charts, TanStack Query for data fetching, and Express/Archiver for the report PDF integration work listed in `package.json`.
