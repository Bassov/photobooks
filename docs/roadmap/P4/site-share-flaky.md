# site-share-flaky

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item site-share-flaky

## Scope

CI flake `e2e/site-viewer.spec.ts:152` (run 43423291077, PR #581): after the Share click "Copied" showed, then "Share" stayed visible for the whole 5 s `toBeHidden` poll. Fix the product in `src/site/ShareButton.tsx`; never loosen the test.

- [x] `src/site/ShareButton.tsx`: the 2 s "Copied" window starts at the first frame that paints it (a jank between the commit and the paint no longer eats into it); a clipboard promise that settles after unmount leaves no timer; a second press during "Copied" restarts the 2 s.
- [x] Tests: `src/site/ShareButton.test.tsx` covers the race with fake timers (late clipboard promise, second click during "Copied"): one label state at a time, "Copied" lasts 2000 ms from the paint, then "Share".
- **Browser check:** 1440×900 `site.html?book=alps`: click Share → "Copied" at the same width, "Share" again after about 2 s; click twice → 2 s from the second click.

## Done when

`e2e/site-viewer.spec.ts:152` passes `--repeat-each=30` locally (plus a throttled run); `ShareButton.test.tsx` locks the race deterministically; other site-viewer / ShareButton tests stay green unchanged in meaning; PR body lists every ShareButton caller as fixed or left out.

Hard nos: `src/publish/**`, `src/editor/publish/**`, `EditorTopBar.tsx`, `SettingsScreen.tsx`, `uikit/**`, `e2e/kit-*`, `.github/workflows/**`; `e2e/site-viewer.spec.ts` assertions unchanged; no backward compat.
