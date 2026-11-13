## Implementation

- [x] 1. Settings nav: Site (`globe`) at index 2; `SettingsScreen` mounts `SiteSettingsSection` (model + screen tests). — `settingsScreenModel.test.ts`, `SettingsScreen.test.tsx`, `e2e/library-screens.spec.ts`
- [x] 2. `SiteSettingsSection`: 3 rows per Spec table, S2 save rule, S3 placeholders, S4 counter / newline paste (unit tests). — `SiteSettingsSection.test.tsx`
- [x] 3. Preview: `SitePreview` uses the store's site meta live; embedded room shows the plain head name (unit + e2e). — `SitePreview.test.tsx`, `SiteBookPage.embedded.test.tsx`, `e2e/site-preview-mode.spec.ts`
- [x] 4. Session-only export keeps the in-memory site settings (`freezeForExport` test). — `exportSiteRun.test.ts`
- [x] 5. `e2e/site-settings.spec.ts`: persist across reload, Preview author, export `<title>` + lead, row heights, empty placeholders, 20-char Intro typing = 0 LoAF + Settings-only commits.

## Manual test scenarios

1. Settings → Site: type a title, author and intro; Tab out; reload: values kept.
2. Esc in Author after typing reverts and keeps focus; Settings stays open.
3. Clear all: placeholders "Photobooks", "Your name", "A line or two about your books"; counter `0 / 160`.
4. Preview site shows the author name in the room head.
