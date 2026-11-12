## Implementation

- [x] 1. e2e first: extend the M100 test in `e2e/printer-presets.spec.ts` with Delete box-shadow at rest / hover / pressed, Cancel unchanged, and the paint row under Delete. (Failed on main with `none`.)
- [x] 2. `src/ui/Button.css`: `--shadow-xs` on `.pb-button--destructive`, `none` on `[data-pressed]`.

## Manual test scenarios

1. Settings → Print presets → a custom profile's More → Delete…: the red Delete button has a faint drop shadow below it; holding the mouse down on it removes the shadow.
   - problem (harness, not product): `pnpm agent manual-qa` timed out at the welcome screen (the header intercepts the `start-session` click). Covered by the e2e `row actions, the Default badge and the delete confirm paint like the kit` (rest / hover / pressed box-shadow + the shadow row pixel), green locally.
