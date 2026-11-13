## Implementation

- [ ] 1. `publishText.ts` + `publishStore.ts` with unit / PBT tests (bands, strings, reducer).
- [ ] 2. `startPublish.ts`: freeze, derivatives, viewer, publish worker, retry on the same freeze, `beforeunload`; unit tests.
- [ ] 3. `PublishButton.tsx` (pill states, sizer, status region, P7 both ways) and the shared `site-job-pill` CSS with Export icon-only below 1360 px.
- [ ] 4. `PublishDialog.tsx` steps connect / opts / run / done / failed; `EditorTopBar` + `EditorSettings` + `SettingsScreen` `initialSection`.
- [ ] 5. Existing test updates (EditorTopBar.test.tsx, design-tokens, comment-only specs, 1280–1359 px label tests).
- [ ] 6. `e2e/in-app-publish.spec.ts`: the 6 Spec § Tests cases with R2 routed, plus the `publish-drag` frame-budget gate.

## Manual test scenarios

1. No hosting: Publish → "Connect your hosting first" → Open Settings → Hosting lands on the Hosting section.
2. Hosting connected: Publish → Publish → Hide → drag a frame; pill shows NN%, then the check; reopen → Published with the link and Open site.
3. 1359 px wide: Export site is icon-only, Publish keeps its label; no page scroll.
