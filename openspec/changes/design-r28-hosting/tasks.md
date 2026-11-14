## Implementation

- [x] 1. 19.5 px line height on the manual-mode pane (M114) — `src/editor/HostingSection.tsx`, e2e `design-r27-hosting.spec.ts` "M114 / M115 / M120" (h2 / help y, help 386.25 and form 367.39 high)
- [x] 2. Drop the ink from `XS_GHOST`; Change → `text-foreground!`, CORS Copy → `text-muted-foreground!` (M120) — `hostingBits.tsx`, `HostingSetup.tsx`, `HostingSection.tsx`
- [x] 3. `e2e/design-r27-hosting.spec.ts`: manual help h2 / block y rel. `main`, setup card y, Copy (muted) and Change (foreground) ink by paint — 11/11 green with `hosting-setup` + `design-r26-icon-classes`

## Manual test scenarios

1. Settings → Hosting at 1440×900 → Set up manually: the help heading sits under the "Set up automatically instead" link; the CORS Copy label is grey (muted), not the dark foreground.
2. Back to guided setup, paste a token, Continue: step 1 Change label is dark foreground ink.

manual-qa (2026-11-15): problem (harness) — both scenarios blocked at the welcome screen: the header intercepts the `start-session` click (known harness issue), product not reached. Covered instead by `e2e/design-r27-hosting.spec.ts` at 1440×900: scenario 1 by "M114 / M115 / M120" (h2 / help y rel. `main`, help and form heights, Copy computed + painted ink rgb(83,81,82)), scenario 2 by "M114 / M115 / M117" (step 1 / 2 Change painted ink rgb(57,55,56)); green locally with `hosting-setup` and `design-r26-icon-classes` (11/11).

ui-review: pass — kit tokens `text-foreground` / `text-muted-foreground` only (no new colours); states unchanged (Copy / Copied swap, hover, focus from Button); muted ink is the kit ghost default; layout locked by e2e boxes.
