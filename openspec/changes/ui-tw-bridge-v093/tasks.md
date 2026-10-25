## Implementation

- [x] 1. Add `tailwindcss` + `@tailwindcss/vite` (kit versions) and wire Vite plugin; add `clsx` / `tailwind-merge` / `class-variance-authority` + `src/ui/cn.ts` — `vite.config.ts`, `package.json`, `src/ui/cn.ts`
- [x] 2. Port kit `@theme` subset + v0.9.3 Procreate-light token values into app CSS entry / `tokens.css`; omit Tailwind preflight; update `docs/design.md` + `check:css-tokens` AA lock — `src/ui/tokens.css`, `src/index.css`, `scripts/check-css-tokens.mjs`
- [x] 3. Specimen proof for `bg-chrome` / `bg-sel` / `text-muted-foreground` (+ unit); update e2e Theme B hex expectations; keep `assert:no-uikit-in-app` green — `SpecimenPage`, `cn.test.ts`, `e2e/design-tokens.spec.ts`; A+B green

## Manual test scenarios

1. `/?specimen` — Tailwind proof chips visible; chrome/sel/muted utilities resolve; no third-party fonts
2. Empty home (`/`) — loads; no page-level scroll from preflight
3. `/?fixture=painter` — editor shell + pasteboard; paper white; canvas/chrome match kit hex
