## Implementation

- [x] 1. 19.5 px line height on the manual-mode pane (M114) — `src/editor/HostingSection.tsx`, e2e `design-r27-hosting.spec.ts` "M114 / M115 / M120" (h2 / help y, help 386.25 and form 367.39 high)
- [x] 2. Drop the ink from `XS_GHOST`; Change → `text-foreground!`, CORS Copy → `text-muted-foreground!` (M120) — `hostingBits.tsx`, `HostingSetup.tsx`, `HostingSection.tsx`
- [x] 3. `e2e/design-r27-hosting.spec.ts`: manual help h2 / block y rel. `main`, setup card y, Copy (muted) and Change (foreground) ink by paint — 11/11 green with `hosting-setup` + `design-r26-icon-classes`

## Manual test scenarios

1. Settings → Hosting at 1440×900 → Set up manually: the help heading sits under the "Set up automatically instead" link; the CORS Copy label is grey (muted), not the dark foreground.
2. Back to guided setup, paste a token, Continue: step 1 Change label is dark foreground ink.
