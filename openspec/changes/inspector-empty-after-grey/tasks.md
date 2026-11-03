## Implementation

- [x] 1. Unit + e2e tests for repro 1–3 and the Hand case (red on main: 4/4 e2e failed with `data-inspector-view` "empty") — `e2e/inspector-context-paths.spec.ts`, `src/editor/inspectorModel.test.ts`, `src/editor/Inspector.test.tsx`
- [x] 2. `inspectorView` without dismissal; first-spread fallback for a null / stale active id — `src/editor/inspectorModel.ts`
- [x] 3. `Inspector` without the `dismissed` state and its Escape listener — `src/editor/Inspector.tsx`
- [x] 4. Spec delta: `spread-view` Inspector context header — `specs/spread-view/spec.md`

## Manual test scenarios

1. `/?fixture=painter`: list row 2–3, click a frame, Esc ×2, grey press on page 1, list row 2–3 → header "Spread", "Pages 2–3 · …".
2. Double-click a filled frame (crop), Esc ×2 → "Spread" for that spread.
3. Esc with nothing selected, then the page-1 row → "Spread", "Page 1 · …".
4. Click a frame, Esc, H, short drag on the pasteboard → "Spread".

Stage-9 `manual-qa`: problem (harness). All 4 scenarios were blocked at the welcome screen: the `start-session` click is intercepted by the welcome header, so no scenario ran. Coverage is `e2e/inspector-context-paths.spec.ts`, which drives the same 4 paths (4/4 pass on this branch, 4/4 fail on main), plus a Playwright DOM dump of the inspector title per step (PR body table).
