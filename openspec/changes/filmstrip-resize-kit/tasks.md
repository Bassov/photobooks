## Implementation

- [x] 1. `store.tsx`: `View.thumb` number | "auto", helpers (auto / max / clamp / snap), v2 storage read + write, `useInnerHeight` (`e2e/kit-filmstrip-resize.spec.ts` auto + reload tests).
- [x] 2. `chrome.tsx` `Filmstrip`: thumbs, filename strip and empty-state row use the effective H (keys test: strip at 92 not 84; empty-state test).
- [x] 3. `chrome.tsx` `Dock`: separator (aria, pointer drag, keys, double-click, hover line, pill, chip); panel-b clips only while collapsed (drag + `elementsFromPoint` test).
- [x] 4. `e2e/kit-filmstrip-resize.spec.ts`: Done-when checks incl. `elementsFromPoint` paint (7 passed locally).

## Manual test scenarios

1. Kit `#/demo` editor 1440 × 900: hover the dock top edge (pill), drag up 52 px (chip "128 px"), release (chip gone), double-click (back to 76).

- harness: `pnpm agent manual-qa` drives the prod editor-shell only, not the kit `#/demo`; scenario 1 is covered step by step by `e2e/kit-filmstrip-resize.spec.ts` (drag / chip / double-click tests, 7 passed) and `e2e/kit-filmstrip.spec.ts` (8 passed).
- OK: `pnpm check:fast` green; `pnpm test:e2e:changed:quiet` green; `uikit:build` + `uikit:qa:quick` 63 passed; `ui-review` pass (labelled separator, keys, focus-visible pill, hover / drag / focus states; empty / happy / drag covered by e2e).
- problem (pre-existing, not this change): `kit-demo-sandbox.spec.ts:273` and `kit-editor-chrome.spec.ts:422` time out locally at load ~30 on main's sandbox code as well.
