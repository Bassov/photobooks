# in-app-publish-kit

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item in-app-publish-kit

## Scope

The kit in-app Publish flow from the Designer Spec `in-app-publish` § Kit changes (§1 pill, §2 dialog, P1–P12). Kit-only:
the upload is simulated, nothing goes to the network.

- [ ] `uikit/src/demo-parts/dialogs.tsx`: `PublishDialog` steps `connect | opts | run | done | failed` per §2 (no size select, no PDF checkbox and their props; run hides on Hide / Esc / outside click; done link `<site>/books/<slug>/` + summary; failed per code with "x of y files went up"); `usePublishRun` modelled on `useExportRun`
- [ ] `uikit/src/demo-parts/editor.tsx`: the Publish pill (sizer, `idle | running | done | failed`, NN% over the #BEBEBE fill, `role="status"`), P7 disabling both ways, disabled with no spreads, Export site label hidden below 1360 px; `DemoEditor` keeps the run alive when hidden and "Open Settings → Hosting" opens Settings on Hosting (`session.tsx` `settingsSection`, read by `settings.tsx` `DemoSettings`)
- [ ] `uikit/src/features/pages.tsx` `in-app-publish` states `connect`, `opts`, `run`, `run-hidden`, `done`, `failed-timeout`, `failed-key` + what / edges
- [ ] `uikit/scripts/demo-capture.mjs`: new step `publish-running-hidden` after `publish-running-50pct`; the demo baseline regenerated
- **Browser check:** kit `#/demo` at 1440×900: top bar → Publish → Publish → Hide; the pill shows NN% and the canvas stays editable, then a check icon; click → Published with the book link; Open site → the site catalog. `#/full/in-app-publish` connect → Open Settings → Hosting.
- **Done when:** e2e `e2e/kit-in-app-publish.spec.ts` pins K1 (connect → Settings → Hosting; opts without size / PDF and the bold host; run phases, 6 px bar, hint, Hide / Esc / outside click hide it; done link + summary; failed timeout "12 of 40 files went up" and key → Open Settings → Hosting; dialog 480 wide, padding 20 24, r 14, bg #E1E1E1), K2 (Publish last in the end group, gap 6, 73.58 ±0.5 wide in every state, running fill paint #BEBEBE via a clipped screenshot, done icon then idle, failed until opened, `role="status"`, P7 both ways, disabled with no spreads) and K3 (Export site icon-only at 1359, labelled at 1360; the seven page states); uikit typecheck + qa green; demo baseline regenerated
- **Hard nos:** no `src/**`, `uikit/src/demo-parts/{site,siteBooks}.tsx`, room files, `uikit/scripts/qa.mjs`, `uikit/src/kit/pages.json`; no network in the kit; no backward compat (Owner 2026-11-02)
- **Test:** Playwright e2e against the kit (paint via clipped screenshots); uikit typecheck + qa
- **UI kit:** `uikit#/feature/in-app-publish`
- **Source:** Designer Spec `in-app-publish` (orch `shared/design/in-app-publish/spec.md`): P2, P3, P7, P10, P11, §1, §2, Kit changes
