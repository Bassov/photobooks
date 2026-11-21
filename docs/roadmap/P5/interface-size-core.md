# interface-size-core

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item interface-size-core
Status: done

## Scope

- [x] Item 1 of 4 of Designer tool 6 `interface-size` (Owner Q-28): spec §2 (scale core) and §3 (viewport units → app units); Musts IS3 (overflow part), IS4 (core), IS10. No Settings UI (item `interface-size`), no §4 overlays / pointer math / DPR consumers (item `interface-size-overlays`), no kit (item `interface-size-kit`).
- [x] `src/ui/uiScale.ts` (new): `UI_SCALES = [1, 1.25, 1.5]`, `UI_SCALE_KEY = "photobooks.ui.scale.v1"`, `readUiScaleChoice()` (anything not `"100" | "125" | "150"` → 1), `setUiScaleChoice(s)`, `effectiveUiScale(choice, w, h)` (D4: largest step ≤ choice with w/s ≥ 1280 and h/s ≥ 720, else 1; never written back), `applyUiScale()` (`--ui-scale` + `data-ui-scale` on `<html>`), `useUiScale()` (`{ choice, effective }`), `uiScale()`, `effectiveDpr()`; `resize` (rAF-throttled) and `storage` listeners. `applyUiScale()` runs before the first render.
- [x] `styles/app.css`: `--ui-scale` and `--app-dvh/svh/vh/vw` tokens, `#root { zoom: var(--ui-scale); container: app / inline-size }`, utilities `h-app` / `min-h-app`.
- [x] §3: every raw `vh|dvh|svh|vw` in `src/editor`, `src/ui`, `src/render` → app token (same value at s = 1); Export site label `@media` 1424 → `@container app`; filmstrip `auto` height reads `innerHeight / uiScale()`.
- **Done when:** `src/ui/uiScale.test.ts` (incl. a PBT for the D4 clamp) and the guard `src/ui/viewportUnits.test.ts` (no raw viewport units in `src/editor`, `src/ui`, `src/render`) are green; `e2e/interface-size-core.spec.ts`: 3840×2160 + `"150"` → `#root` zoom 1.5 and `scrollHeight = innerHeight`, `scrollWidth = innerWidth` on welcome, library and editor; 1920×970 + `"150"` → zoom 1.25; 1440×900 + `"125"` → zoom 1; no key → zoom 1; existing unit / e2e / design specs pass untouched.
- **Browser check:** 3840×2160 with `localStorage["photobooks.ui.scale.v1"] = "150"`: welcome, library and editor fill the window at 1.5× with no page scroll.
- **Hard nos:** `uikit/**`, `src/render/SpreadView.*`, `src/render/PhotoChrome.tsx`, `src/editor/{crop*,frameHandle*,photoGesture}*`, `src/editor/frameClipboard.ts`, `src/editor/bookHistory.ts`, `e2e/frame-copy-paste.spec.ts`, `e2e/fixtures/coverage.ts`, `stryker.config.mjs`, `.github/**`.
- **Test:** `src/ui/uiScale.test.ts`, `src/ui/viewportUnits.test.ts`, `e2e/interface-size-core.spec.ts` (new).
- **Depends:** none.
