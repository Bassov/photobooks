## Implementation

- [x] 1. Record in-repo SVG decision in `docs/design.md`; add `--icon-size-14/16/20` tokens
- [x] 2. Add `Icon` primitive + ~24 in-repo SVG icons (`src/ui/Icon.tsx`, `src/ui/icons/`)
- [x] 3. Extend `?specimen` with icon grid + size tokens
- [x] 4. Unit tests: sizes, decorative `aria-hidden`, labeled name; specimen section
- [x] 5. E2e / verify; ui-review; tick roadmap scope — `pnpm verify:fast:quiet` OK; `pnpm test:e2e:changed:quiet` OK
- [x] 6. Manual QA; archive / roadmap done / finish

## Manual test scenarios

1. OK Open `/?specimen`: 24 icons; size 20; decorative aria-hidden; page fits; specimen scrollport overflows
2. OK Open `/` (empty home): Photobooks visible; no page-level H/V scroll
3. OK Open `/?fixture=painter`: editor-shell; filmstrip; pasteboard vertical scrollport; no page-level scroll

### ui-review

- Design system: `Icon` + `--icon-size-*` recorded in `docs/design.md`; in-repo SVG (not lucide in app). Pass.
- A11y: decorative default `aria-hidden`; labeled `role=img`; size controls have `aria-label` + `aria-pressed`; focus-visible on size buttons. Pass.
- Layout smoke (e2e): empty `/`, painter pasteboard scrollport, specimen vertical scrollport + icon grid/size 20. Pass.
- Anti-slop: Theme B tokens only; no purple/glow/emoji icons. Pass.
