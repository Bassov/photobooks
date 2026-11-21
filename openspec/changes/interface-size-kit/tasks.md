## Implementation

- [x] 1. Session `uiScale` + D4 `effectiveUiScale` + `useStageScale` + `UiScaleCtx` (`uikit/src/demo-parts/session.tsx`).
- [x] 2. `demo-root` and `#/demo` zoom to the effective scale (`root.tsx`, `features/demo.tsx`).
- [x] 3. Settings → Interface §1 row replaces the Units / Thumbnail size / Density stub (`settings.tsx`).
- [x] 4. `site-settings` scenarios `interface-clamped`, `interface-focus`; demo-capture step `settings-interface`.
- [x] 5. `e2e/kit-interface-size.spec.ts` (6 tests).

## Manual test scenarios

1. `/uikit/#/full/site-settings` at 1440×900 → Interface: one row, 100% selected, hint "Bigger text and controls for 4K screens."
2. Pick 150% → hint "Window too small for 150%: showing 100%.", nothing grows.
3. At 1920×1080 pick 125% → the stage grows 1.25×, no scrollbars.

Results (agent manual-qa cannot drive the kit; evidence = kit e2e + `#/demo` walk):

- OK 1–3: `e2e/kit-interface-size.spec.ts` 6/6; `pnpm test:e2e:quiet e2e/kit-` 396/396.
- OK `#/demo` walk: 94 steps, `91-settings-interface.png` shows the one row at 100 %.
