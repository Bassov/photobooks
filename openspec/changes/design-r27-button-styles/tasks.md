## Implementation

- [ ] 1. `Button.css`: ghost inherits its ink; primary hover `--primary-hover`
- [ ] 2. Kit-muted ghosts (zoom menu, crop-reset, adjust-reset, photo-remove) get `text-muted-foreground`
- [ ] 3. `Badge.css`: sm dot padding-left 4 px; unit test for the dot flag
- [ ] 4. `e2e/design-r27-button-styles.spec.ts` paint checks (Hosting ghosts, two primary hovers, dot vs plain badge, kept-muted ghosts)

## Manual test scenarios

1. Settings → Hosting (guided): Check again / Cancel setup read dark; hover Set up hosting.
2. Connected state: badge box, Forget ink.
3. Editor: zoom menu and inspector Reset buttons stay muted.
