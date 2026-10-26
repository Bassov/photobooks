## Decisions

1. **Vendor italic faces** — copy `lora-{cyrillic,latin-ext,latin}-wght-italic.woff2` from `@fontsource-variable/lora` into `public/fonts/` and mirror into `uikit/src/fonts/`; extend both `fonts.css` with matching `font-style: italic` `@font-face` (same unicode-ranges as roman). No new runtime dep.
2. **Headline weight 400** — set `.pb-welcome-headline { font-weight: 400 }` so h1 is not browser-default bold; do not use `.heading` / `--heading-weight` (500). Keep size/leading/tracking tokens already bridged.
3. **Keep `<em>` + synthesis** — markup already uses `<em>`; with italic faces shipped, leave `body { font-synthesis: none }`. Only switch to `font-synthesis-weight: none` if italic still fails after faces ship.
4. **skip_specs** — Welcome already SHALL match kit chrome; optical type is a chrome-align fix, no domain contract delta.

## Touch-set & Test Plan

- Files: `public/fonts/*`, `uikit/src/fonts/*`, `src/editor/welcomeScreenStyles.ts` (+test); leave `WelcomeScreen.test.tsx` unless markup changes
- Reuse: existing Inter/Lora Variable families, `--text-welcome-display`, kit Welcome markup
- Tests: unit asserts injected CSS has `font-weight: 400` and fonts.css declares italic Lora faces; e2e Welcome empty + Create Library + viewport fit unchanged
- Gates: no coverage/Stryker/e2e threshold changes; `assert:no-uikit-in-app`; skill `ui-review` before push
