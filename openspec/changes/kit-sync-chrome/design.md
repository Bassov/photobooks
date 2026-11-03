## Decisions

1. KS1: `DEMO_VIEWS` (`demo-parts/editor.tsx`) = snap, grid. `DemoEditor` passes `view={{ guides: false, rulers: false, overlays: false }}` to `Std` (existing prop → `StudioProvider`), so `canvas.tsx` / `viewport.tsx` stay untouched. Guides / rulers keep prod's keys (Ctrl+;, Shift+R); DPI and overlays leave `#/demo` as in prod.
2. M39: kit `TopBar` (`sandbox/chrome.tsx`) takes prod's `.editor-top-grid` columns (`200px 1fr auto 1fr 288px`), centring the tools on the canvas (676 at 1440).
3. KS8: delete `SpreadActions`, rendered at the end of `SpreadsPanel`; the row menu "Add after" stays.
4. KS14: new `demo-parts/presentation.tsx`, a kit port of prod `SpreadPager` + `PresentationMode` (values per the roadmap item): `bg-presentation` token, ResizeObserver-measured fit, capture-phase keys, prod test ids.

## Touch-set & Test Plan

| File                                    | Why                        |
| --------------------------------------- | -------------------------- |
| `uikit/src/demo-parts/editor.tsx`       | views, defaults, Preview   |
| `uikit/src/demo-parts/presentation.tsx` | presentation mode          |
| `uikit/src/sandbox/chrome.tsx`          | TopBar grid, no Add spread |
| `uikit/src/features/pages.tsx`          | page copy                  |
| `uikit/scripts/qa.mjs`                  | KS1 / KS8 / KS14 asserts   |
| `uikit/scripts/demo-capture.mjs`        | view steps use keys        |

- Reuse: `MiniSpread`, `SiteCover`; tokens `presentation`, `shadow-stage-dark` already in the kit (`docs/design.md`: kit wins).
- Tests: kit qa on `#/demo` covers empty (no Add spread), happy (presentation on the cover), interact (→, Esc); skill `ui-review`.
