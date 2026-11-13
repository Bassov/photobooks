## Decisions

1. New `uikit/src/demo-parts/siteSettings.tsx` holds the Site card and Theme tiles; `settings.tsx` only swaps its Site branch. Rows reuse Hosting's row shape and `BOX` / `ring()`.
2. Text fields keep a draft: blur / Enter commits the cleaned value only when it differs; Esc restores the stored value and keeps focus; newlines become spaces on change. Kit write is instant.
3. `SettingsScreen` `onSite?`: with it the `site` prop is the stored value (`DemoSettings` → `set({ site })`), without it local state.
4. Theme: `role=radiogroup`, roving tabindex, arrows select. States reuse `shadow-tile-hover` / `shadow-tile-select`; new `--shadow-tile-rest`; values per the Spec.
5. Dark = `d.site.theme === "dark"` on `DemoSite` and `DemoSitePreview` (+ `texts={d.site}`); `SysSite` already does `ss-dark` + `usePaperBars`.

## Touch-set & Test Plan

| File                                    | Why                                                       |
| --------------------------------------- | --------------------------------------------------------- |
| `uikit/src/features/site/sample.ts`     | `theme`                                                   |
| `uikit/src/demo-parts/siteSettings.tsx` | new card                                                  |
| `uikit/src/demo-parts/settings.tsx`     | Site branch, `onSite`                                     |
| `uikit/src/demo-parts/site.tsx`         | `dark`, Preview `texts`                                   |
| `uikit/src/features/pages.tsx`          | scenarios + notes                                         |
| `uikit/src/index.css`                   | `--shadow-tile-rest`                                      |
| `docs/design.md`                        | Theme tiles token line                                    |
| `e2e/kit-site-texts.spec.ts`            | locks (proposal list + row heights, selected-ring pixels) |
