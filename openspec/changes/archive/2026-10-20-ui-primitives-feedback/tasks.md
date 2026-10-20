## Implementation

- [x] 1. Touch `.skip-specs`; schedule overlays follow-on (`ui-primitives-overlays`) — size split after planning review
- [x] 2. Implement Status / Toast / Badge / ProgressBar / EmptyState (RAC + tokens CSS) — `src/ui/{Status,Toast,toastQueue,Badge,ProgressBar,progressFill,EmptyState,specimenFeedback}.*`
- [x] 3. Extend `?specimen` feedback section — `data-testid=specimen-feedback`
- [x] 4. Component unit tests through public props; e2e specimen feedback interact — `pnpm verify:fast:quiet` OK; `pnpm test:e2e:changed:quiet` OK
- [x] 5. Verify + ui-review; tick roadmap scope; Manual QA; archive / done / finish

## Manual test scenarios

1. OK Open `/?specimen`: feedback section — polite Status, error Toast + Show files action, Badge tones, ProgressBar determinate/indeterminate, EmptyState Add folder…; specimen scrollport only (`e2e/design-tokens.spec.ts` + unit)
2. OK Open `/` (empty home): Photobooks visible; no page-level H/V scroll (`e2e/design-tokens.spec.ts`)
3. OK Open `/?fixture=painter`: editor-shell; filmstrip + pasteboard scrollports; no page-level scroll (`e2e/design-tokens.spec.ts`)

### ui-review

- Design system: Status/Toast/Badge/ProgressBar/EmptyState use Theme B tokens (`--badge-*`, `--popover`, `--success`, `--destructive`); inventory noted in `docs/design.md` migration audit. Pass.
- A11y: polite/assertive live regions; Toast close labelled; ProgressBar `aria-label`; EmptyState actions keyboard-reachable via Button; focus-visible rings; reduced-motion on progress animation. Pass.
- Layout smoke (e2e): empty `/`, painter pasteboard scrollport, specimen vertical scrollport + feedback interact. Pass.
- Anti-slop: tokens only; no purple/glow. Pass.
