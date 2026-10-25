## Implementation

- [x] 1. Add `tailwindcss` + `@tailwindcss/vite` (kit versions) and wire Vite plugin; add `clsx` / `tailwind-merge` / `class-variance-authority` + `src/ui/cn.ts` — `vite.config.ts`, `package.json`, `src/ui/cn.ts`
- [x] 2. Port kit `@theme` subset + v0.9.3 Procreate-light token values into app CSS entry / `tokens.css`; omit Tailwind preflight; update `docs/design.md` + `check:css-tokens` AA lock — `src/ui/tokens.css`, `src/index.css`, `scripts/check-css-tokens.mjs`
- [x] 3. Specimen proof for `bg-chrome` / `bg-sel` / `text-muted-foreground` (+ unit); update e2e Theme B hex expectations; keep `assert:no-uikit-in-app` green — `SpecimenPage`, `cn.test.ts`, `e2e/design-tokens.spec.ts`; A+B green

## Manual test scenarios

1. `/?specimen` — expect `data-testid=specimen` and `specimen-tw-bridge` visible; `tw-bg-chrome` / `tw-bg-sel` / `tw-text-muted` resolve kit colors; do **not** expect `editor-shell`
   - OK: `e2e/design-tokens.spec.ts` specimen + computed rgb for chrome/sel/muted (playwright list, 4 passed)
2. Empty home (`/`) — expect Photobooks heading / home copy; document fits viewport; do **not** expect `editor-shell`
   - OK: same spec “empty home and painter editor use Theme B chrome tokens”
3. `/?fixture=painter` — expect `editor-shell` + `pasteboard-scroll`; `--paper` white, `--canvas` `#c8cacb`, `--chrome` `#e1e1e1`
   - OK: same spec pasteboard scrollport + “book paper and canvas use light Theme B tokens”

ui-review: design tokens from docs/design.md / kit v0.9.3; no parallel colour system; layout smoke via e2e above; a11y muted-foreground AA lock `#535152`; no new branded marketing surface.
