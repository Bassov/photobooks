## Implementation

- [x] 1. `src/ui/uiScale.ts` core + `uiScale.test.ts` (unit + D4 PBT).
- [x] 2. `applyUiScale()` in `mountPhotobooks` before render.
- [x] 3. `styles/app.css` tokens, `#root` zoom + container, `h-app` / `min-h-app`.
- [x] 4. §3 replacements (welcome, library, editor shell, dialogs, toast, relink, filmstrip, library styles) + Export site `@container app`; filmstrip heights in app px.
- [x] 5. Guard `src/ui/viewportUnits.test.ts`.
- [x] 6. `e2e/interface-size-core.spec.ts` (4K @150, clamps, IS7, no key).

## Manual test scenarios

1. 3840×2160 with `localStorage["photobooks.ui.scale.v1"] = "150"`: welcome, library and editor fill the window at 1.5× with no page scroll.
2. 1440×900 without the key: the editor looks as before (zoom 1).
