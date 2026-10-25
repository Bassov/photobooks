## Decisions

1. **Tailwind 4 via Vite plugin** — match kit (`tailwindcss` / `@tailwindcss/vite` ^4.3.3) in root `package.json` + `vite.config.ts`. App never imports `uikit/src/**`.
2. **Theme + utilities only, no preflight** — `@import "tailwindcss/theme"` + `utilities` (skip `preflight`) so existing hand-CSS screens keep CI e2e green until later ports.
3. **Kit v0.9.3 tokens win** — port `@theme` / `@theme inline` + Procreate-light `:root` values into `src/ui/tokens.css` + CSS entry (grayscale chrome, `--color-sel: #CACACA`, gray `--crop`). Update `check:css-tokens` AA lock and `docs/design.md` hex notes intentionally. Keep Inter/Lora.
4. **`cn` stack = kit** — add `clsx` + `tailwind-merge` (+ `class-variance-authority` for future ports) under `src/ui/cn.ts`; leave existing `cx` for BEM callers.
5. **Proof** — specimen chip using Tailwind utilities + unit assert on `cn`; e2e token hex expectations follow kit.

## Touch-set & Test Plan

- Files: `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `src/index.css`, `src/ui/tokens.css`, `src/ui/cn.ts`, `src/ui/SpecimenPage.*`, `scripts/check-css-tokens*`, `docs/design.md`, `e2e/design-tokens.spec.ts`
- Reuse: kit `uikit/src/index.css` + `uikit/src/lib/utils.ts` as copy source; app fonts unchanged
- Tests: unit `cn` + specimen Tailwind classes; e2e specimen + Theme B hex lock-ins; `assert:no-uikit-in-app`; `audit:ci`
- Gates: no coverage / Stryker / e2e threshold changes
