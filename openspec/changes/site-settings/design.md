## Decisions

1. `SiteSettingsSection` ports kit `siteSettings.tsx` (#586) with `ROW` / `settingsRule` and the Hosting BOX + `ring()`; each field keeps a local draft and commits via `setSiteSettings` only when the clean value differs.
2. Only the section and `SitePreview` subscribe to the store (`useSyncExternalStore`); Preview passes `siteMetaOf({ site })`.
3. The embedded room renders the head name as a plain `<span class="ss-name">` (kit `Head preview`).
4. `freezeForExport` with no library seeds `{ site }` from the store (#584 gap).
5. e2e commit probe via the React DevTools hook: every rendered component sits inside `site-settings`.

Tokens: `bg-chrome`, `bg-field`, `text-muted-foreground` (`docs/design.md`). e2e covers empty, happy and typing; skill `ui-review` before push. No gate config edits.

## Touch-set & Test Plan

| File                                      |
| ----------------------------------------- |
| `src/editor/settingsScreenModel.ts`       |
| `src/editor/settingsScreenModel.test.ts`  |
| `src/editor/SettingsScreen.tsx`           |
| `src/editor/SettingsScreen.test.tsx`      |
| `src/editor/SiteSettingsSection.tsx`      |
| `src/editor/SiteSettingsSection.test.tsx` |
| `src/editor/SitePreview.tsx`              |
| `src/editor/SitePreview.test.tsx`         |
| `src/site/SiteRoom.tsx`                   |
| `src/site/SiteBookPage.embedded.test.tsx` |
| `src/editor/export/exportSiteRun.ts`      |
| `src/editor/export/exportSiteRun.test.ts` |
| `e2e/site-settings.spec.ts`               |
| `e2e/fixtures/reactCommits.ts`            |
| `e2e/library-screens.spec.ts`             |
| `e2e/site-preview-mode.spec.ts`           |
