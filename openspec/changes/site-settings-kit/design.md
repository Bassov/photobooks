## Decisions

1. New `uikit/src/demo-parts/siteSettings.tsx` holds the Site card; `settings.tsx` only swaps its Site branch. Rows reuse Hosting's row shape and `BOX` / `ring()`.
2. Text fields keep a draft: blur / Enter commits the cleaned value only when it differs; Esc restores the stored value and keeps focus; newlines become spaces on change. Kit write is instant.
3. `SettingsScreen` `onSite?`: with it the `site` prop is the stored value (`DemoSettings` → `set({ site })`), without it local state.
4. One look (Owner 2026-11-13, S5 / S6 cancelled): no Theme row, no `SiteTexts.theme`. Nothing reaches the kit's dark look any more, so it goes (no backward compat): `.ss.ss-dark`, `.sd-dark` / `[data-dark]` rules, `SiteProps.dark` → `ReadingRoom` → `BookReader` → `ReaderGl`, the GL `dark` option in `OpenBook` / `ClosedBook` (light constants kept).
5. `DemoSitePreview` passes `texts={d.site}` so the Preview home lead is the session's.

## Touch-set & Test Plan

| File                                        | Why                                 |
| ------------------------------------------- | ----------------------------------- |
| `uikit/src/demo-parts/siteSettings.tsx`     | new card                            |
| `uikit/src/demo-parts/settings.tsx`         | Site branch, `onSite`               |
| `uikit/src/demo-parts/site.tsx`             | Preview `texts`                     |
| `uikit/src/features/pages.tsx`              | `site-empty` scenario + notes       |
| `uikit/src/features/parts.tsx`              | scenario tabs scroll in the strip   |
| `uikit/src/features/site/sys.tsx`           | drop `dark`                         |
| `uikit/src/features/site/system.css`        | drop `.ss.ss-dark`                  |
| `uikit/src/features/site/base.css`          | drop `.sd-dark` / `[data-dark]`     |
| `uikit/src/features/site-book/room.tsx`     | drop `dark`                         |
| `uikit/src/features/site-book/reader.tsx`   | drop `dark`                         |
| `uikit/src/features/site-book/reader.css`   | drop `.sd-dark` shadow              |
| `uikit/src/features/site-book/book3d.tsx`   | drop GL `dark`                      |
| `uikit/src/features/site-book/book3d.css`   | drop `.ss-dark` floor               |
| `uikit/src/features/site-book/gl/open.ts`   | drop `OpenLook.dark`                |
| `uikit/src/features/site-book/gl/closed.ts` | drop `dark`                         |
| `e2e/kit-site-texts.spec.ts`                | K1 rows, counter, K3, look, Preview |
