# dark-theme

Tag: feature
Milestone: M2.5
Title: dark neutral theme

## Scope

- [ ] Dark values for semantic tokens on `[data-theme]`; default from `prefers-color-scheme`, toggle in the top bar persisted per browser
- [ ] Book pages keep their paper color in both themes; baselines and axe checks run in both themes
- **Perf:** a theme switch is one attribute write on the root; no React re-render of spreads. Gate: toggle the theme while the fixture book is scrolled mid-pasteboard — zero LoAF.
- **Browser check:** switch themes with the fixture book open; chrome flips, photos and pages do not change color; contrast stays readable; reload keeps the choice.
- **UI ref:** `uikit#/feature/dark-theme`
