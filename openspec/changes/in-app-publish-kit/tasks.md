## Implementation

- [ ] 1. `PublishDialog` steps connect / opts / run / done / failed + `usePublishRun` (`dialogs.tsx`)
- [ ] 2. Shared site-job pill, Publish pill states, P7, Export site icon-only below 1360 (`editor.tsx`)
- [ ] 3. `DemoEditor`: publish run, Hide keeps it, Open Settings → Hosting (`editor.tsx`, `settings.tsx`, `session.tsx`)
- [ ] 4. `in-app-publish` page states + what / edges (`pages.tsx`)
- [ ] 5. `demo-capture.mjs` step `publish-running-hidden`; baseline regenerated
- [ ] 6. e2e `kit-in-app-publish.spec.ts` (K1–K3) and KM3 update

## Manual test scenarios

1. Kit `#/demo` 1440×900: editor → Publish → Publish → Hide; the pill shows NN%, a frame drag still works, then the check icon; clicking it shows Published with `https://books.basov.photo/books/<slug>/`; Open site → catalog.
2. `#/full/in-app-publish` connect → Open Settings → Hosting; failed-key → Open Settings → Hosting.
