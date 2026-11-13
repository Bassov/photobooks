## Decisions

1. `publishStore.ts` mirrors `exportSiteStore`: pure reducer, 250 ms throttle, 4 s done; one run, percent never goes back.
2. Percent bands and every string live in `publishText.ts`; derivatives come from the existing worker pool (`collectSiteDerivatives`), the build and upload from `publish.worker.ts`.
3. Try again reuses the last freeze (no new `publishBook`); `beforeunload` guards a run (P12).
4. P7: each pill subscribes to the other store's running flag.
5. Pill CSS is shared (`site-job-pill*`); only Export's label hides below 1360 px.
6. Failure text = code + bucket + status (the S3 answer from the redacted worker message).
7. Settings open state carries `initialSection`.
8. Security: the page reads `loadHostingSummary` only; Open site uses `noopener,noreferrer`; CSP unchanged.

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

- Tokens `--field`, `--control`, `--color-meter` (`docs/design.md`); skill `ui-review` before push.
- Unit / PBT: reducer, bands, texts, run deps, pill, dialog.
- e2e: empty (connect), happy (done, republish), interact (Hide + drag, pill width, 503 retry, 403 key); gate `publish-drag`.
