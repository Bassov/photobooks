## Implementation

- [x] 1. `publishText.ts` + `publishStore.ts` with unit / PBT tests (bands, strings, reducer).
- [x] 2. `startPublish.ts`: freeze, derivatives, viewer, publish worker, retry on the same freeze, `beforeunload`; unit tests.
- [x] 3. `PublishButton.tsx` (pill states, sizer, status region, P7 both ways) and the shared `site-job-pill` CSS with Export icon-only below 1360 px.
- [x] 4. `PublishDialog.tsx` steps connect / opts / run / done / failed; `EditorTopBar` + `EditorSettings` + `SettingsScreen` `initialSection`.
- [x] 5. Existing test updates (EditorTopBar.test.tsx, design-tokens, comment-only specs, 1280–1359 px label tests).
- [x] 6. `e2e/in-app-publish.spec.ts`: the 6 Spec § Tests cases with R2 routed, plus the `publish-drag` frame-budget gate.

## Manual test scenarios

1. No hosting: Publish → "Connect your hosting first" → Open Settings → Hosting lands on the Hosting section.
   - problem (harness): `pnpm agent manual-qa` timed out on `start-session` (welcome header intercepts the click). Covered by `e2e/in-app-publish.spec.ts` "connect" case and `EditorTopBar.test.tsx` "Publish without hosting opens Settings on Hosting" (pass).
2. Hosting connected: Publish → Publish → Hide → drag a frame; pill shows NN%, then the check; reopen → Published with the link and Open site.
   - problem (harness): same `start-session` block. Covered by `e2e/in-app-publish.spec.ts` publish → done and pill width / Hide / drag cases, plus the `publish-drag` gate (0 LoAF) (pass).
3. 1359 px wide: Export site is icon-only, Publish keeps its label; no page scroll.
   - problem (harness): same `start-session` block. Covered by `e2e/design-r11-topbar.spec.ts` "P11 site pills" at 1359 / 1360 px with `assertDocumentFitsViewport` (pass).
