## Implementation

- [x] 1. Remove product theme switching: `ThemeToggle`, `preferredTheme`, mount/boot persistence, top-bar wiring, related CSS.
- [x] 2. Collapse `src/ui/tokens.css` (and uikit CSS) to Theme B light on `:root`; drop `b-dark` / extra `[data-theme]` sets and kit theme switch / dark-theme specimen.
- [x] 3. Update unit/e2e (design-tokens, a11y-contrast, TopBar/mount) and `docs/design.md` dark-mode policy; confirm no obsolete openspec/specs theme requirements (none in openspec/specs).

## Manual test scenarios

1. Empty home: Photobooks chrome uses light Theme B; no theme toggle in UI.
   - OK Empty home: Photobooks chrome uses light Theme B; no theme toggle in UI.
2. Happy painter editor: top bar has no moon/sun control; pasteboard/chrome stay light tokens; paper unchanged.
   - OK Happy painter editor: top bar has no moon/sun control; pasteboard/chrome stay light tokens; paper unchanged.
3. `?specimen`: token page loads without theme switcher; swatches resolve.
   - OK `?specimen`: token page loads without theme switcher; swatches resolve.

UI review: `.cache/ui-review-single-theme.md` — pass (no blocking findings).
