# ui-welcome-type-v93

Tag: feature
Milestone: M3
Title: Welcome Lora italic + weight 400 vs kit
Status: done

## Scope

- [x] Ship Lora Variable italic `@font-face` (latin + latin-ext + cyrillic) into `public/fonts/` + `public/fonts/fonts.css` from `@fontsource-variable/lora` wght-italic; sync into `uikit/src/fonts` + `fonts.css` (keep `assert:no-uikit-in-app` green)
- [x] `.pb-welcome-headline`: explicit `font-weight: 400`; keep size/leading/tracking; keep `<em>` second line
- [x] Leave `font-synthesis: none` if real italic loads; only fall back to `font-synthesis-weight: none` if needed
- **UI kit:** `uikit/src/features/library.tsx` (`WelcomeScreen` h1), `UI ref: uikit#/screen/first-run`
- **Browser check:** Welcome h1 is Regular 400 Lora; second line is true Lora italic (not upright synthetic); Inter + Lora Variable families unchanged; Create Library still works; document fits viewport
- **Perf:** Font face adds must not regress Welcome idle / Create Library click path frame budget
- **Size:** ~200–600 changed lines (mostly woff2)
- **Source:** Owner package W (chrome-align)

## Done when

Welcome optical type matches kit: weight 400 + real italic line 2; CI green on PR head.
