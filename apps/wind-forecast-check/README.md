# Wind Forecast Check: Frontend Application

This directory contains the React + TypeScript frontend for the Wind Forecast Check application.

- **Framework**: React 18, Vite, TypeScript, Tailwind CSS
- **Component System**: `@project/components` (Radix UI primitives)
- **State & Data**: React Query with dual-mode data client (`src/lib/client.ts`)
  - Calls Python FastAPI backend (`/api/*`)
  - Automatically falls back to in-browser execution with live Elexon BMRS streaming if backend is unavailable

## Scripts

```bash
# Start Vite development server
npm run dev

# Run TypeScript type check
npm run typecheck

# Run Vitest unit tests
npm test

# Build production bundle
npm run build
```
