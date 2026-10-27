## Decisions

1. `SpreadPager` (render, presentational, no editor imports): props `count`, `index`, `onIndexChange`, `onExit`, `renderSpread(i)`. Owns keys (←/→/Space/Esc, capture; ignores typing targets itself), click halves, swipe (>60px), fit-to-viewport scale. Index±1 stay mounted at `opacity:0`; `ConnectedSpreadView` requests their tiers through the existing tier path (worker decode), so flips show decoded images. Slides use `transform`/`opacity` only.
2. `PresentationMode` (editor) wraps it with `ConnectedSpreadView` (same `SpreadView`); start = selected spread.
3. While presenting, `EditorShell` unmounts `Pasteboard` (shared per-spread tier state is cleared on cleanup); camera is a global store, so it survives.
4. UI: `fixed inset-0` overlay above chrome and toast, `--presentation` backdrop with `--shadow-stage-dark` (kit tokens, added to docs/design.md), `Icon` 16 for exit, no page-level scroll (overlay fixed, `overflow:hidden`). Present button = `ChromeButton` beside Preview, disabled with zero spreads. `ui-review` on the overlay.

## Touch-set & Test Plan

- Files: `src/render/SpreadPager.{tsx,css}`, `pagerIndex.ts`, `src/editor/PresentationMode.tsx`, `EditorShell.tsx`, `EditorTopBar.tsx`, `docs/design.md`, `package.json` (`perf` script adds the new spec's frame-budget test), spread-view spec delta.
- Tests: PBT clamp; SpreadPager unit (keys/click/swipe/Esc/neighbours); e2e `presentation-mode.spec.ts` incl. `frame-budget` flip of 40 spreads (zero LoAF).
