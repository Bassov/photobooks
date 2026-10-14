# Design

## Context

Today: `src/perf/loafObserver.ts` + `exposePerf.ts` with `LOAF_BLOCKING_BUDGET_MS = 200`; e2e asserts via `/?loaf=1`. No CDP throttle, INP/rAF/measure helpers, budgets module, COOP/COEP, or React Compiler. See proposal.md; specs: `frame-budget`, `photo-card`, `preview-hosting`.

## Goals / Non-Goals

**Goals:** Shared budgets; expanded `__photobooksPerf`; Playwright CI gates (zero LoAF / INP / handler p95) + frame-stats artifact; `pnpm perf` hard frame pacing; COOP/COEP + `crossOriginIsolated`; enable React Compiler; replace 200 ms wording in rules/quality bar/skill/lessons.

**Non-Goals:** Product UI; AVIF/WASM; new interaction scenarios beyond photo-card import (fixture must support future scenarios).

## Decisions

1. **Budgets** — `src/perf/budgets.ts` is SoT. Defaults: `handlerP95Ms: 2`, `inpMs: 100`, `frameP95Ms: 16.7`, `droppedFrameRatio: 0.02`, `loafEntriesMax: 0`. `cpuThrottleRate` calibrated to **2** (4× caused LoAF ~50–80 ms on photo-card import). E2e mirrors the same numbers.

2. **Observers** — Keep LoAF; add `framePacing.ts` (rAF → p95 / drop %), `eventTiming.ts` (INP), `measureHandler.ts` (`performance.measure` wrapper). `assertNoLoafEntries()` replaces `assertNoExcessiveBlocking(200)`. Remove `LOAF_BLOCKING_BUDGET_MS`.

3. **Enable gate** — DEV or `?perf=1` or legacy `?loaf=1`. Full API on `window.__photobooksPerf`.

4. **Always-on CI asserts for import** — Instrument the photo open/load kickoff with `measureHandlerSync` (worker warm outside measure). Scenario: click Open photo (INP), then filechooser `setFiles`, wait for card. CI hard-fails: zero LoAF; INP / handler p95 against budgets **× cpuThrottleRate** (throttle scales wall-clock). No “skip if empty” escape.

5. **Playwright fixture** — `e2e/perf/perfFixture.ts`: CDP throttle from budgets, clear → act → assert, attach frame-stats JSON. `pnpm perf` sets `PERF_HARD_FRAME_PACING=1` for hard frame asserts; CI attaches stats report-only.

6. **Headers** — `public/_headers` (Vite copies `public/` → `dist/`):

```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: credentialless
```

`credentialless` (not `require-corp`) so Google Fonts keep loading while `crossOriginIsolated` is true. Mirror on Vite `server`/`preview`. Assert `dist/_headers` after build; e2e asserts `crossOriginIsolated` on Vite preview; Workers apply `_headers` from assets.

7. **React Compiler** — `@vitejs/plugin-react` `compiler: true` with peer `oxc-transform-react` (Vite 8 / plugin-react v6 path).

8. **Doc sync** — architecture.mdc, config.yaml quality bar, react-perf-spa, lessons (60 fps), AGENTS.md, roadmap nested checkboxes.

## Touch-set

- `src/perf/*`, photo open path (`useOpenPhoto` / equivalent) for `measureHandler`
- `vite.config.ts`, `public/_headers`, `package.json` + lockfile
- `e2e/perf/*`, `e2e/photo-card.spec.ts`, `.github/workflows/integration.yml`
- Docs/rules/skills above

## Composition

Small modules under `src/perf/`; `exposePerf` is the window seam. E2e fixture owns CDP — app never imports Playwright.

## Tests

Unit: public APIs of budgets/observers/`exposePerf` (mock observers/rAF). E2e: `ensurePhotoFixtures` + isolation + zero-LoAF/INP/handler import. Public API only.

## Security

COOP/COEP are security-surface headers (`same-origin` / `credentialless`). Do not weaken to `unsafe-none` or add permissive CORP `*`. Security Review before archive. `audit:ci` on lockfile change.

## Risks / Trade-offs

- [CI flake under 4×] → calibrate `cpuThrottleRate` in budgets; document chosen rate.
- [Click-then-setInputFiles INP semantics] → assert INP from the Open-photo click in the same scenario window.
- [Fonts + isolation] → COEP `credentialless` keeps Google Fonts loading.

## Migration Plan

One PR. Rollback = revert. No data migration.
