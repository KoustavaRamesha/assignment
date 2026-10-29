# Wind Forecast Check: GB Wind Forecast vs Actual, January 2026

A production-grade web application and analytical portal for UK day-ahead power buyers to evaluate national-level wind forecast accuracy against actual generation from Elexon BMRS for January 2026.

Built with **React (TypeScript + Tailwind CSS)** frontend and **Python (FastAPI)** backend, with full Docker containerization and dual test coverage (Vitest + Pytest).

---

## 1. Quick Start

### Option A: Docker Compose (Recommended)
Run both the Python backend and React frontend with a single command:
```bash
docker compose up --build
```
- **Web App**: http://localhost:8080
- **Python API & Swagger Docs**: http://localhost:8000/docs

To run the unit tests inside Docker:
```bash
docker compose --profile test run --rm test
```

### Option B: Local Development

1. **Install Frontend Dependencies** (from repo root):
   ```bash
   npm install
   ```

2. **Start the Python Backend**:
   ```bash
   pip install -r backend/requirements.txt
   uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
   ```

3. **Start the React Frontend**:
   ```bash
   npm --prefix apps/wind-forecast-check run dev
   ```
   Open http://localhost:8080 in your browser.

> **Zero-Config Standalone Fallback**: If the Python backend is not running, the web application automatically falls back to in-browser execution with live Elexon BMRS queries, ensuring seamless operation in any environment without configuration.

---

## 2. Testing & Quality Assurance

Dual test suites verify deadline picking, deduplication, and accuracy metrics:

- **Frontend / Domain Logic (Vitest)**:
  ```bash
  npm test
  # or: npm --prefix apps/wind-forecast-check test
  ```
  *12 unit tests pass.*

- **Backend / Domain Logic (Pytest)**:
  ```bash
  python -m pytest backend/test_wind.py
  ```
  *12 unit tests pass.*

- **TypeScript Typecheck**:
  ```bash
  npm run typecheck
  # or: npm --prefix apps/wind-forecast-check run typecheck
  ```
  *Compiles clean with zero errors (exit code 0).*

---

## 3. Repository & Directory Structure

```
.
├── backend/
│   ├── main.py              # FastAPI REST endpoints (/api/day, /api/accuracy, /api/coverage, /api/versions)
│   ├── wind.py              # Core Python domain logic: Elexon fetch, dedupe, deadline pick, metrics
│   ├── test_wind.py         # 12 Pytest unit tests
│   ├── requirements.txt     # Python dependencies (FastAPI, httpx, uvicorn)
│   └── Dockerfile           # Python 3.12 slim container
├── apps/
│   └── wind-forecast-check/ # React + TypeScript + Vite frontend
│       ├── src/
│       │   ├── api/         # Local endpoint execution fallbacks
│       │   ├── components/  # Day picker, deadline selector, tiles, charts
│       │   ├── content/     # Static report data for executive dashboard
│       │   ├── lib/         # Client API wrapper and TypeScript wind logic
│       │   ├── pages/       # Forecast, Accuracy, Proof, Coverage, Report tabs
│       │   ├── App.tsx      # Main application shell with tab navigation
│       │   └── main.tsx     # Application entry point
│       ├── tests/           # 12 Vitest unit tests (wind.test.ts)
│       ├── Dockerfile       # Nginx production build + reverse proxy
│       └── vite.config.ts   # Vite configuration with API proxy
├── packages/
│   └── components/          # Shared UI component library (Radix UI / Tailwind)
├── docker-compose.yml       # Multi-service composition (backend + frontend + tests)
├── .env.example             # Optional environment variable template
└── README.md                # Documentation and submission details
```

---

## 4. Problem & Business Context

In the UK wholesale electricity market, day-ahead power procurement occurs one day before physical delivery. Energy utilities must forecast renewable wind generation to accurately calculate how much thermal/peaking power to procure. 

This product answers two core questions for day-ahead buyers:
1. **What was the latest wind forecast available when purchasing decisions were made?**
2. **How accurate were those forecasts quantitatively, and what error margins (MAE, bias, P90) must be planned for?**

### Data Sources
Data is sourced directly from **Elexon BMRS**:
- **WINDFOR**: National wind power generation forecasts (hourly resolution, with publish timestamps).
- **FUELHH** (`fuelType=WIND`): Actual half-hourly wind generation (MW).

### Deadline & Picking Rules
- Purchasing decisions occur at a fixed day-ahead deadline (default **09:20 UK / UTC**, with presets for **09:50** and **15:30**).
- For delivery day $D$, the deadline is $D-1$ at the specified time.
- **Picking Rule**: For every delivery period, the application selects the latest forecast version published strictly at or before the deadline. Post-deadline versions are excluded to prevent look-ahead bias.

### Energy Calculation (MWh)
- **Forecasts** are hourly MW points, so each hourly point represents $1.0\text{ h}$ ($MWh = MW \times 1.0$).
- **Actuals** are half-hourly MW points, so each point represents $0.5\text{ h}$ ($MWh = MW \times 0.5$).
- Daily energy sums accurately reconcile across both day-view tiles and monthly executive summaries.

---

## 5. Quantitative Findings (January 2026)

| Deadline | MAE (MW) | Bias (MW) | P90 Error (MW) | nMAE (%) | Avg Lead Time | Valid Pairs |
|---|---|---|---|---|---|---|
| **09:20** | 2,127 | +1,852 | 4,313 | 18.4% | 28 h | 744 |
| **09:50** | 2,107 | +1,840 | 4,383 | 18.2% | 26 h | 744 |
| **15:30** | 1,968 | +1,817 | 4,030 | 17.0% | 20 h | 744 |

- **Persistent Over-Forecasting**: Wind forecasts systematically over-predicted actual generation by $+1.8\text{ GW}$ on average across January 2026.
- **Deadline Sensitivity**: Moving from 09:20 to 15:30 reduces MAE by ~7% due to the 09:30 and 15:30 Elexon forecast publication runs.

---

## 6. AI Tools Disclosure

As permitted and encouraged by the assignment guidelines, AI development tools (including Claude and Gemini via Antigravity) were utilized to assist with codebase architecture, data modeling, testing, and UI component integration. All analytical logic, Elexon API integrations, and unit tests have been independently validated.
