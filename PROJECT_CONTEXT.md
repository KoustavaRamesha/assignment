# Project Context & Assignment Specifications

## 1. Problem Setting & Requirements
The client is an energy utility in the UK responsible for buying required power from the UK day-ahead market. To meet consumer electricity demand, they need to know how much thermal/peaking power must be procured beyond weather-dependent renewable generation (wind). Decisions are made day-ahead, so they rely on renewable generation forecasts.

### Goals
1. Clearly understand latest renewable generation forecasts available when making day-ahead market purchasing decisions.
2. Evaluate accuracy of renewable generation forecasts quantitatively (considering quantified error, MAE, bias, P90, nMAE).

### Data Scope
- National level wind generation actuals and forecasts from Elexon BMRS alone.
- **Actuals (FUELHH)**: https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream
  - fuelType: "WIND"
  - startTime: target time (30-minute resolution)
  - generation: actual wind power (MW)
- **Forecasts (WINDFOR)**: https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream
  - startTime: target delivery start time (hourly points)
  - publishTime: time forecast was generated/published
  - generation: forecasted wind power (MW)
- Target period: Decisions made in January 2026.

### Tech Stack & Deliverables
- **Frontend**: React (TypeScript, Vite, Tailwind/components)
- **Backend**: Python (FastAPI, httpx, uvicorn)
- **Containerization**: Docker & docker-compose
- **Testing**: Vitest (TS) & Pytest (Python)
- **Deliverables**:
  - Unlisted YouTube video demo (Part 1: Pitch to client <= 5 min; Part 2: Tech walkthrough <= 5 min; Max 10 min total)
  - Public GitHub repository with clean README, folder map, how to run, and deployment info
  - Microsoft Form submission

---

## 2. Key Findings & Fixes Required in Codebase
1. **Energy Calculation Bug**:
   - Forecasts in WINDFOR are published hourly (each row covers 1 hour: `MW * 1.0h = MWh`).
   - Actuals in FUELHH are half-hourly (each row covers 0.5 hours: `MW * 0.5h = MWh`).
   - The previous code multiplied both by `0.5`, resulting in forecast daily energy being exactly 2x too low (e.g. 139,315 MWh vs Report's 278.6 GWh).
2. **Python Backend**:
   - Ported and created in `backend/` with FastAPI (`main.py`), pure core domain logic (`wind.py`), Pytest suite (`test_wind.py`), and `Dockerfile`.
3. **Zite Debranding**:
   - Strip `.zite/` configs, runtime scripts, and plugins from `index.html`, `vite.config.ts`, `main.tsx`.
   - Update tab order: default to `Forecast`, tabs ordered: `Forecast`, `Accuracy`, `Proof`, `Coverage`, `Report`.
   - Change page title and remove Zite branding tags.
4. **Fix Typecheck & Scripts**:
   - Change `npx tsgo` to `tsc --noEmit` in `package.json`.
   - Create `.env.example`.
5. **Docker & Git**:
   - Update `docker-compose.yml` to support frontend and Python backend.
   - Verify tests pass.
   - Initialize git and push to GitHub repository.

