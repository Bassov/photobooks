## Decisions

1. Fix locally with margin utilities and class rules in the existing injected style modules (the app has no Tailwind preflight, so UA margins leak); no global token or `button` change (other lanes).
2. New `src/editor/kitTypeStyles.ts`: a `'Lora Upright'` `@font-face` family generated from `BOOK_FONT_FACES` (same woff2, upright only) for Library/Welcome display text, plus a `.pb-kit-type` scope that sets the kit `--text-xs--line-height: 1.4` / `--text-sm--line-height: 1.45` (Tailwind utilities read these vars).
3. Lora display text is weight 400 (kit inline `font-family`, not `--heading-weight`); credit links get inline `color: inherit` (the unlayered global `a { color }` beats the layered utility).
4. Settings: `leading-[1.2]` on the section title, `Badge color="success"`, `.pb-settings-back` (gap 4, pl 6, no border; ink/font stay with design-r10-chrome, M58).

## Touch-set & Test Plan

- Files: `src/editor/{kitTypeStyles,libraryScreenStyles,welcomeScreenStyles}.ts` (+ tests), `WelcomeScreen.tsx`, `WelcomePhotoCaption.tsx`, `LibraryEmpty.tsx`, `LibraryScreen.tsx`, `SettingsScreen.tsx` (+ component tests), `e2e/design-r10-library.spec.ts`, `docs/design.md` (Type row: `.pb-kit-type`, Lora Upright).
- Reuse: `BOOK_FONT_FACES` + `unicodeRangeCss`; idempotent style-inject pattern; tokens `--text-xs`, `--text-sm`, `--font-heading`, `Badge`.
- Tests: unit tests first for `kitTypeStyles` and the touched modules; e2e (Welcome, empty library, library with a book, Settings) against kit values measured on `uikit#/demo`; skill `ui-review` before push.
