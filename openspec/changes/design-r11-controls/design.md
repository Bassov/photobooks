## Decisions

1. M68 root fix: `styles/app.css` `@layer base` gets `input, textarea, select { font: inherit; … color: inherit }` (kit preflight subset, as M58 for `button`). Base layer, so component CSS and utilities still win (`text-sm` Pages, select fonts).
2. Book W/H inputs and PRINT B/S values take `font-mono` (kit `v7.tsx` :136/:170); `--font-mono` = kit stack (`tokens.css`).
3. M70 in `src/ui/Button.css`: `.pb-button` drops the 1 px transparent border (kit has none); `sm` padding 0 12 (`--spacing*3`), `md` 0 16 (`--spacing*4`) = kit `px-3` / `px-4`. `secondary` drops its `--border` ring and keeps `--shadow-xs` = kit `outline` + `shadow-xs`. `outline` stays the borderless `--field` fill = kit `outline`.
4. Call sites pick the kit variant (no per-site styling): Crop (idle) `outline` → `secondary` (kit `shadow-xs`), Flip H/V `secondary` → `outline` (kit has no shadow on Flip; rendered `#/demo` wins over the review text).
5. M71: library bar `.pb-lib-change` gets the kit 24 px full pill in `libraryScreenStyles.ts`; Settings nav `border-r border-transparent` (kit 195 px rows), active row `bg-accent` (#CFCFCF), `.pb-settings-back` ink.

## Touch-set & Test Plan

- Files: `styles/app.css`, `tokens.css`, `src/ui/Button.css`, `src/editor/BookSettingsSection.tsx`, `FitCropSection.tsx`, `PhotoRotateSection.tsx`, `SettingsScreen.tsx`, `settingsScreenModel.ts`, `libraryScreenStyles.ts`, `docs/design.md` (Button row).
- Reuse: tokens `--shadow-xs`, `--accent`, `--field`, `--spacing`; kit `font-mono`.
- Tests: unit — Settings active class, Crop/Flip variants, mono classes. e2e `e2e/design-r11-controls.spec.ts`: kit values per Must; no-Arial audit on happy (inspectors), empty (empty library) and interact (crop, Settings) states; earlier `design-*` specs and `pb-button--secondary` consumers re-run. Skill `ui-review` before push.
