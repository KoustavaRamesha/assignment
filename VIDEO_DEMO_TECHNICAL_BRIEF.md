# Wind Forecast Check: Technical & Analytical Briefing for Video Demo

This briefing provides all key quantitative findings, domain context, software architecture details, and data engineering specifications required to script the 10-minute video presentation.

---

## PART 1: Commercial & Client Overview (Pitch to Energy Utility)

### 1. Client Persona & Problem Context
- **Target Audience**: Power Procurement & Trading Desk at a UK Energy Utility.
- **Responsibility**: Buying wholesale electricity in the UK Day-Ahead Auction (EPEX SPOT / Nord Pool) to fulfill consumer demand.
- **Core Dilemma**:
  - Electricity demand must be satisfied continuously in 30-minute settlement periods.
  - Power purchases must be locked in on day $D-1$ (one day ahead) before 11:00 / 12:00 market gate closure.
  - Renewable wind power is non-dispatchable and weather-dependent. The desk must accurately predict wind generation to calculate how much thermal, gas-fired (CCGT), or peaking power must be bought.
  - **The Financial Trap (Imbalance Risk)**: If wind generation is over-forecasted, the utility under-buys thermal power day-ahead and is left short in real-time. This shortfall is cashed out via Elexon Balancing Mechanism at punitive System Buy Prices (SBP), exposing the utility to severe cash-out penalties.

---

### 2. Analytical Findings: January 2026 (The Pilot Study)

The pilot analysis ingested national wind generation and forecasts from **Elexon BMRS** across all 31 days of January 2026.

#### Key Quantitative Metrics (At Default 09:20 D-1 Deadline)
- **Mean Absolute Error (MAE)**: **2,127 MW** (average miss per delivery hour).
- **Normalised MAE (nMAE)**: **18.4%** of average metered generation.
- **Systematic Bias**: **+1,852 MW** (87% of the total absolute error is pure over-prediction).
- **P90 Error Margin**: **4,313 MW** (10% of delivery periods had errors exceeding 4.3 GW).
- **Monthly Volume Gap**:
  - Forecasted Wind Energy: **9.99 TWh**
  - Delivered Actual Wind: **8.62 TWh**
  - Net Forecast Over-estimate: **+1.38 TWh (+16.0%)**
- **Net Market Financial Impact**:
  - Estimated GB-wide shortfall cash-out penalty: **≈ £4.0m net** (shortfall volume priced at System Imbalance Price vs Day-Ahead Market Index).

#### Deadline Sensitivity Comparison
Elexon updates wind forecasts multiple times daily. Evaluating procurement decisions under different day-ahead operational cut-offs reveals:

| Deadline | Elexon Run Used | MAE (MW) | Bias (MW) | P90 Error (MW) | % Miss (nMAE) | Avg Lead Time |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **09:20** | 07:30 UTC | 2,127 MW | +1,852 MW | 4,313 MW | 18.4% | 28.0 h |
| **09:50** | 09:30 UTC | 2,107 MW | +1,840 MW | 4,383 MW | 18.2% | 26.2 h |
| **15:30** | 15:30 UTC | 1,968 MW | +1,817 MW | 4,030 MW | 17.0% | 20.3 h |

- **Insight**: Pushing procurement decisions to 15:30 achieves a **7.5% reduction in MAE** (saving ~160 MW per hour in uncertainty), but the structural +1.8 GW bias persists across all runs.

#### Daily & Hourly Extremes
- **Worst Delivery Day**: **28 January 2026**
  - Forecasted: 267.2 GWh | Delivered: 138.2 GWh (**MAE: 5,329 MW**, 48% miss).
  - The forecast predicted sustained gale-force generation that rapidly collapsed in real time.
- **Other Severe Over-forecast Days**:
  - 11 Jan (MAE: 4,853 MW), 12 Jan (MAE: 4,875 MW), 21 Jan (MAE: 3,677 MW), 27 Jan (MAE: 3,419 MW).
- **Diurnal / Hourly Error Profile**:
  - Highest error occurs **overnight (00:00–07:00 UTC)**, averaging 2,300–2,520 MW MAE.
  - Lowest error occurs in late afternoon (16:00–18:00 UTC), averaging ~1,850 MW MAE.
  - Error magnitude does **not** correlate with forecast lead time (hours ahead), proving the error is **meteorological/structural**, not a decaying forecast horizon artifact.

---

### 3. Actionable Commercial Recommendations for the Client Desk
1. **Implement Dynamic De-Biasing**: Rather than taking raw Elexon forecasts at face value, apply a rolling hourly subtraction factor (~1,500–1,800 MW) before calculating thermal procurement requirements.
2. **Asymmetric Risk Hedging on Windy Nights**: For delivery periods 00:00–07:00 where forecast exceeds 15 GW, procure additional spinning reserve or day-ahead peaking capacity.
3. **Exploit the 15:30 Publication Run**: For intraday volume flexibility, rebalance commitments against the 15:30 forecast run to capture the 7.5% accuracy gain.

---

### 4. Interactive Portal Walkthrough (What to Show in UI)
1. **Forecast Tab**:
   - Day Picker: Toggle between days (e.g. Day 15 normal, Day 28 extreme miss).
   - KPI Tiles: Forecast Energy (MWh), Actual Energy (MWh), Lowest/Highest Forecast points.
   - Dual-Series Chart: Recharts interactive line plot showing hourly forecast dots vs 30-min actual line.
2. **Accuracy Tab**:
   - Top-level cards: MAE, Bias (+1,852 MW), P90 (4,313 MW), nMAE (18.4%), Valid Pairs (744).
   - Daily Bar Chart: Visualizing daily MAE across all 31 days.
   - Hourly Bar Chart: Displaying error by time of day with lead-time tooltips.
3. **Proof Tab (Trust & Auditability)**:
   - Eliminates look-ahead bias: Select a delivery day and hour (e.g. Jan 12, 01:00).
   - Timeline Chart: Shows all historical forecast releases from 60h prior to delivery.
   - Dashed line indicates decision deadline; big primary dot highlights the exact version the buyer had. Shows why using the latest post-deadline version is a trap.
4. **Coverage Tab**:
   - Funnel Analysis: 1,488 expected half-hours $\rightarrow$ 1,488 actuals $\rightarrow$ 744 hourly forecasts $\rightarrow$ 744 matched pairs (100% of maximum possible data coverage).
   - Schedule visualizer showing Elexon's publication cycle (02:30, 04:30, 07:30, 09:30, 11:30, 15:30, 18:30, 22:30 UTC).
5. **Report Tab**:
   - Executive Dashboard with verified/estimate badges, financial impact summary, and one-click PDF report download.

---

## PART 2: Technical Architecture & Engineering Review (Internal Tech Lead)

### 1. System Architecture & Tech Stack

```
                          ┌─────────────────────────────────────┐
                          │         Elexon BMRS API             │
                          │   WINDFOR (hourly) / FUELHH (30m)   │
                          └──────────────────┬──────────────────┘
                                             │ JSON Streams
                                             ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                FastAPI Python Backend                                  │
│  ┌───────────────────────┐   ┌──────────────────────────┐   ┌───────────────────────┐  │
│  │     Data Ingestion    ├──►│ Deduplication & Filtering├──►│ Deadline & Analytics  │  │
│  │ (Async HTTPX Batches) │   │ (Pure Functional Domain) │   │ (MAE, Bias, P90, MWh) │  │
│  └───────────────────────┘   └──────────────────────────┘   └───────────┬───────────┘  │
│                                                                         │              │
│  REST API Endpoints:                                                    │              │
│  - GET /api/day?day=15&deadline=09:20                                   │              │
│  - GET /api/accuracy?deadline=09:20                                     │              │
│  - GET /api/coverage?deadline=09:20                                     │              │
│  - GET /api/versions?day=12&slot=2&deadline=09:20                       │              │
└────────────────────────────────────────┬───────────────────────────────────────────────┘
                                         │ JSON API (CORS enabled)
                                         ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              React 18 + Vite Frontend                                  │
│  - TypeScript strict typing (no any, tsc --noEmit clean)                               │
│  - Tailwind CSS + Radix UI Primitives                                                  │
│  - Recharts for composed, responsive visualisations                                   │
│  - Dual-mode Client (src/lib/client.ts):                                               │
│      * Normal: REST calls to Python FastAPI backend                                     │
│      * Fallback: Pure browser-side TypeScript calculation against Elexon               │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 2. Core Domain Logic & Mathematical Formulations

#### A. Data Ingestion & Time-Windowing
- **Endpoints**:
  - Forecast: `https://data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR/stream`
  - Actuals: `https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH/stream?fuelType=WIND`
- **Windowing Formulation**:
  - Actuals required: `2026-01-01T00:00:00Z` to `2026-02-01T00:00:00Z` (plus 1-day safety margin).
  - Forecasts required: Elexon publishes forecasts up to **66.5 hours ahead**. To cover `2026-01-01T00:00:00Z` delivery, the forecast fetch must begin at least 3 days prior:
    $$\text{FORECAST\_FETCH\_START} = \text{2025-12-20T00:00:00Z}$$
    This satisfies the window invariant:
    $$\text{FetchStart} < \text{Jan1Start} - (\text{MaxLead} \times 3600\text{ s})$$

#### B. Deduplication Rules (Pure Functional Implementation)
1. **Forecast Deduplication (`dedupe_forecasts`)**:
   - Unique Composite Key: `startTime | publishTime`
   - Filter out target times outside January 2026 (`startTime < 2026-01-01` or `startTime >= 2026-02-01`).
   - Identical repeats (same key and generation): Dropped silently.
   - Conflicting values (same key, different generation): Logged as data anomaly; first seen is retained.
   - Result: ~25,000 raw rows deduplicated into 18,240 unique version records.
2. **Actuals Deduplication (`dedupe_actuals`)**:
   - When Elexon re-publishes metering adjustments for a half-hour slot, keep the record with the **latest `publishTime`**.

#### C. Decision Deadline & Version Picking Rule
- For delivery day $D$, deadline is $D-1$ at HH:MM UTC:
  $$\text{Deadline}(D, \text{hh:mm}) = D_{\text{start}} - 86,400\text{ s} + (h \times 3600 + m \times 60)$$
- Version Eligibility:
  $$\text{Eligible}(v) \iff v.\text{publishMs} \le \text{DeadlineMs}$$
- Selection:
  $$\text{Picked} = \arg\max_{v \in \text{Eligible}} (v.\text{publishMs})$$
  Versions published after the deadline are strictly excluded to avoid look-ahead bias.

#### D. Physical Energy Metric Formulation ($MWh = MW \times \Delta t$)
*This was the critical bug fix in earlier iterations:*
- **Forecasts**: WINDFOR publishes at **hourly** intervals ($\Delta t = 1.0\text{ h}$).
  $$\text{ForecastEnergy (MWh)} = \sum_{i=1}^{24} MW_{i} \times 1.0\text{ h}$$
- **Actuals**: FUELHH publishes at **half-hourly** intervals ($\Delta t = 0.5\text{ h}$).
  $$\text{ActualEnergy (MWh)} = \sum_{j=1}^{48} MW_{j} \times 0.5\text{ h}$$
- When both are summed over the 24 hours of Day 15, both yield **~254–278 GWh**, reconciling the day-view KPI tiles with the executive monthly summary.

#### E. Accuracy Metrics Formulation
Given $n$ valid pairs $(F_i, A_i)$ where both forecast and metered actual exist:
- **Error**: $e_i = F_i - A_i$
- **MAE**: $\frac{1}{n} \sum_{i=1}^{n} |e_i|$
- **Bias**: $\frac{1}{n} \sum_{i=1}^{n} e_i$
- **P90 Error**: Nearest-rank quantile on sorted absolute errors $|e|_{(1)} \le |e|_{(2)} \le \dots \le |e|_{(n)}$:
  $$k = \lceil 0.90 \times n \rceil, \quad P90 = |e|_{(k)}$$
- **Normalised MAE (nMAE)**:
  $$\text{nMAE} = \frac{\text{MAE}}{\frac{1}{n}\sum_{i=1}^{n} A_i} \times 100\%$$

---

### 3. Verification, Testing & Code Quality

#### Dual Test Suites (24 Tests Total)
Both TypeScript and Python test suites run identical test cases verifying domain logic independently:

1. **Vitest (TypeScript Frontend)**:
   - File: `apps/wind-forecast-check/tests/wind.test.ts`
   - Command: `npm test`
   - Result: **12 / 12 tests pass** (duration ~400ms).
2. **Pytest (Python Backend)**:
   - File: `backend/test_wind.py`
   - Command: `pytest backend/test_wind.py`
   - Result: **12 / 12 tests pass** (duration ~100ms).

#### Test Breakdown:
- **Test 1**: Deadline calculation for Day 10 at 09:20 and 15:30 resolves to Day 9 UTC.
- **Test 2**: Picking selects the latest version published before deadline.
- **Test 3**: Boundary condition: version published *exactly* at deadline is eligible.
- **Test 4**: Look-ahead prevention: version published 1 minute after deadline is rejected.
- **Test 5**: Version order invariance (handles unsorted inputs).
- **Test 6**: Full 48-slot day generation with proper null-gaps for half-hours.
- **Test 7**: Forecast deduplication drops identical rows.
- **Test 8**: Conflicting forecast records flag collision and keep first.
- **Test 9**: Out-of-window February records are trimmed; versions sorted ascending by publish time.
- **Test 10**: Actuals deduplication retains latest publish timestamp for duplicate slots.
- **Test 11**: Accuracy metrics (MAE, Bias, P90 nearest rank, nMAE) calculate correctly on sparse pairs.
- **Test 12**: Energy calculation multiplies forecast by 1.0h and actuals by 0.5h.

#### Static Type Checking:
- `tsc -p apps/wind-forecast-check/tsconfig.app.json --noEmit` exits with **0 errors**.

---

### 4. Containerization & Deployment Workflows

#### A. Multi-Service Docker Compose (`docker-compose.yml`)
- `backend`: FastAPI running on port `8000`.
- `frontend`: Nginx alpine container on port `8080`, reverse-proxying `/api/` calls to `http://backend:8000/api/`.
- `test`: Automated CI container running Pytest.
- Command: `docker compose up --build`

#### B. Production Single-Container Dockerfile (`Dockerfile`)
- **Stage 1 (Node 20 alpine)**: Builds React Vite static bundle (`npm run build`).
- **Stage 2 (Python 3.12 slim)**: Installs backend requirements, copies static bundle into `/app/dist`, and serves both the API (`/api/*`) and SPA routing (`/*`) via FastAPI + Uvicorn on `${PORT:-8000}`.
- Compatible with **Heroku Container**, **Render**, **Railway**, and **GCP Cloud Run**.

#### C. Vercel & Heroku Deployment Configuration
- `vercel.json`: Pre-configured Vite build and routing for instant Vercel deployment.
- `Procfile`: Pre-configured `web: uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}` for Heroku Git deployments.

---

### 5. Repository Structure Reference

```
.
├── backend/
│   ├── main.py              # FastAPI endpoints, CORS, optional static SPA serving
│   ├── wind.py              # Pure Python domain logic: Elexon streaming, dedupe, metrics
│   ├── test_wind.py         # 12 Pytest unit tests
│   ├── requirements.txt     # fastapi, httpx, uvicorn
│   └── Dockerfile           # Backend container
├── apps/
│   └── wind-forecast-check/ # React Vite TypeScript app
│       ├── src/
│       │   ├── api/         # In-browser fallback endpoints
│       │   ├── components/  # DayPicker, DeadlinePicker, Recharts cards
│       │   ├── lib/         # client.ts (dual-mode client), wind.ts (TS domain logic)
│       │   ├── pages/       # Forecast, Accuracy, Proof, Coverage, Report
│       │   ├── App.tsx      # Main application layout & header
│       │   └── main.tsx     # Root entrypoint
│       ├── tests/           # 12 Vitest unit tests (wind.test.ts)
│       ├── Dockerfile       # Nginx production proxy
│       └── vite.config.ts   # Vite configuration with API proxy
├── packages/
│   └── components/          # Radix UI + Tailwind shared UI library
├── docker-compose.yml       # Multi-service composition
├── Dockerfile               # Production single-container build
├── Procfile                 # Heroku deployment process
├── vercel.json              # Vercel deployment config
├── README.md                # Public project documentation & AI disclosure
└── .env.example             # Environment variable template
```
