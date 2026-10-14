# Proposal

## Problem

The LoAF scenario gate allows `blockingDuration` ≤ 200 ms (~12 dropped frames). That is too weak for the product’s 60 fps requirement. Measurement is incomplete (no INP, hot-handler timing, or frame pacing), CI cannot throttle CPU, and the app is not cross-origin isolated — blocking SharedArrayBuffer / multithreaded WASM later.

## Why now

First M1 prep item in `docs/roadmap.md`. Every later `[feature]` depends on these gates; leaving the 200 ms budget in place would bake in a false “done” signal.

## Scope in

- Shared perf budgets + expanded `__photobooksPerf` (LoAF, rAF pacing, Event Timing / INP, `performance.measure` helpers)
- Playwright perf fixture with CDP CPU throttling; CI hard-fails zero LoAF / INP / handler p95; frame pacing report-only artifact
- `pnpm perf` locally with hard frame-pacing asserts
- **BREAKING** (gates): replace 200 ms LoAF budget with zero LoAF entries; update quality bar / architecture rule / skill / lessons
- COOP / COEP (`credentialless`) headers (preview + Vite); verify `crossOriginIsolated`
- Enable React Compiler

## Scope out

- Product UI / editor features (filmstrip, pasteboard, …)
- AVIF / WASM encode (only isolation groundwork)
- LOD painter fallback

## Capabilities

### New Capabilities

- `frame-budget`: measurement APIs, shared budgets, CI vs local gate split for 60 fps proxies

### Modified Capabilities

- `photo-card`: import scenario must record zero LoAF entries (replace ≤ 200 ms)
- `preview-hosting`: production/preview responses include COOP/COEP; page is cross-origin isolated

## Success criteria

- Photo-card 24MP import e2e under CDP CPU throttle hard-fails on zero LoAF, INP, and handler p95 against shared budgets (architecture defaults unless calibrated in design)
- CI publishes frame-pacing stats as a report-only (non-blocking) artifact for that scenario
- `pnpm perf` runs the same scenario with hard frame-pacing asserts on a real machine
- Budgets live in one module consumed by tests and benches
- Preview / Vite preview: `crossOriginIsolated === true`
- React Compiler enabled; docs/rules no longer assume a missing Compiler
- Security Review pass for headers before archive

## Risks

- **Security:** COOP/COEP change the embedder/opener policy surface — misconfiguration can break asset loads or weaken isolation; Security Review required
- Zero-LoAF under 4× throttle may flake on noisy CI — throttle rate may need calibration in this change
- React Compiler may surface new lint/build failures — must stay green under `verify:fast`
