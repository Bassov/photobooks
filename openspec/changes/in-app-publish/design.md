## Decisions

1. **Store**: `publishStore.ts` mirrors `exportSiteStore` (pure `reducePublish`, same clock / 250 ms throttle / 4 s done expiry). States `idle | running {percent} | done {summary, bookUrl, homeUrl} | failed {failure}`; one run at a time, percent is `max(old, new)`.
2. **Bands** (`publishText.ts`): main-thread derivatives 0–40, worker render 40–50, upload 50–95 by bytes, finish 95–100. The run line's phase comes from the percent (<50 / <95 / else), as in the kit.
3. **Run** (`startPublish.ts`): `runPublishBook(deps)` = hosting summary (null → `unconnected`) → `freezeForExport` (`publishBook`) → `collectSiteDerivatives` → viewer → `createPublishWorker` with `{input, bookId}`. Try again reuses the module's last frozen revisions (no new `publishBook`); P5 makes a reload-retry send only the rest too. A `beforeunload` guard lives from start to the final message (P12).
4. **P7**: each pill subscribes to the other store's `running` boolean; disabled with the wait title on a `display:contents` wrapper.
5. **Pill CSS**: `export-site-pill*` (used nowhere else) becomes the shared `site-job-pill*`; only Export's label carries `site-job-pill__label--narrow`, hidden below 1359.98 px (P11).
6. **Failed text** from code + bucket (hosting summary) + status; `other` takes the S3 answer out of the worker's redacted message; worker `render` → `build`, `unconnected` → hosting action.
7. **Settings**: top bar state `SettingsSectionId | null`; `EditorSettings` / `SettingsScreen` take `initialSection`.
8. **Security**: no credential on the page (P8: worker loads them); the page reads only `loadHostingSummary` (no secret); Open site = `window.open(home, '_blank', 'noopener,noreferrer')`; CSP unchanged.

## Touch-set & Test Plan

| Path                                          |
| --------------------------------------------- |
| `src/editor/publish/PublishButton.tsx`        |
| `src/editor/publish/PublishButton.test.tsx`   |
| `src/editor/publish/PublishDialog.tsx`        |
| `src/editor/publish/PublishDialog.test.tsx`   |
| `src/editor/publish/publishStore.ts`          |
| `src/editor/publish/publishStore.test.ts`     |
| `src/editor/publish/publishText.ts`           |
| `src/editor/publish/publishText.test.ts`      |
| `src/editor/publish/startPublish.ts`          |
| `src/editor/publish/startPublish.test.ts`     |
| `src/editor/EditorTopBar.tsx`                 |
| `src/editor/EditorTopBar.test.tsx`            |
| `src/editor/EditorSettings.tsx`               |
| `src/editor/SettingsScreen.tsx`               |
| `src/editor/export/ExportSiteButton.tsx`      |
| `src/editor/export/ExportSiteButton.css`      |
| `src/editor/export/ExportSiteButton.test.tsx` |
| `e2e/in-app-publish.spec.ts`                  |
| `e2e/design-tokens.spec.ts`                   |
| `e2e/design-r11-topbar.spec.ts`               |
| `e2e/design-r2-toolbar-kitset.spec.ts`        |

- Reuse: `freezeForExport`, `collectSiteDerivatives`, `loadSiteViewerBundle`, `nextAnnouncedPercent`, `ChromeButton`, `Dialog`, `ProgressBar`, glyphs, tokens `--field` / `--control` / `--color-meter`.
- Unit / PBT: reducer (percent monotone, one run), bands monotone and bounded, every fail code text + action, summary plural / MB; run deps (no hosting, retry reuses the freeze, beforeunload on/off); pill states + P7; dialog steps.
- e2e: the 6 Spec § Tests cases with R2 routed; frame-budget gate `publish-drag`.
