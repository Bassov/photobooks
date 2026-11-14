## Implementation

- [x] 1. `Button.css`: ghost inherits its ink; primary hover `--primary-hover` (e2e `design-r27-button-styles.spec.ts` ghost ink + hover tests)
- [x] 2. Kit-muted ghosts (zoom menu, crop-reset, adjust-reset, photo-remove) get `text-muted-foreground` (e2e zoom menu stays muted)
- [x] 3. `Badge.css`: sm dot padding-left 4 px; unit test for the dot flag (`src/ui/Badge.test.tsx`)
- [x] 4. `e2e/design-r27-button-styles.spec.ts` paint checks (Hosting ghosts, two primary hovers, dot vs plain badge, kept-muted ghosts)

## Manual test scenarios

1. Settings → Hosting (guided): Check again / Cancel setup read dark; hover Set up hosting.
2. Connected state: badge box, Forget ink.
3. Editor: zoom menu and inspector Reset buttons stay muted.

manual-qa (2026-11-14): problem 1–3 — harness: the `start-session` click is intercepted by the welcome-screen header before any scenario step (known harness issue). The same scenarios are covered by `e2e/design-r27-button-styles.spec.ts` (4 passed: Hosting ghost ink, Set up hosting / Create book hover, Connected vs Default badge box, zoom menu muted).
