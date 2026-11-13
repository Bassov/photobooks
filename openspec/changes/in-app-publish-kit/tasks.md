## Implementation

- [x] 1. `PublishDialog` steps connect / opts / run / done / failed + `usePublishRun` (`dialogs.tsx`)
- [x] 2. Shared site-job pill, Publish pill states, P7, Export site icon-only below 1360 (`editor.tsx`)
- [x] 3. `DemoEditor`: publish run, Hide keeps it, Open Settings → Hosting (`editor.tsx`, `settings.tsx`, `session.tsx`)
- [x] 4. `in-app-publish` page states + what / edges (`pages.tsx`)
- [x] 5. `demo-capture.mjs` step `publish-running-hidden`; baseline regenerated (81 steps, no page errors; publish 53–56)
- [x] 6. e2e `kit-in-app-publish.spec.ts` (K1–K3) and KM3 update

## Manual test scenarios

1. Kit `#/demo` 1440×900: editor → Publish → Publish → Hide; the pill shows NN%, the editor stays usable (Esc, outside click), then the check icon; clicking it shows Published with `https://books.basov.photo/books/<slug>/`; Open site → catalog.
   - OK: demo walk steps 53–56 + 61 (shot 55 shows `50%` over the fill, Export site disabled); e2e K2 `#/demo` run/Hide/done. manual-qa cannot drive the kit; evidence is the walk, e2e and kit qa:quick 422/422.
2. `#/full/in-app-publish` connect → Open Settings → Hosting; failed-key → Open Settings → Hosting.
   - OK: e2e K1 connect → `hosting-form`; K2 failed-key pill → `hosting-recheck`.
