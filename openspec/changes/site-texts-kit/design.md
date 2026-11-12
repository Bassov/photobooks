## Decisions

1. The site texts live in the #/demo session: `SessionState.site: SiteTexts = { title, author, intro }`, default the Spec sample; Settings → Site reads them; e2e seeds them through `__demo` (no new scenario tabs: the site-settings strip is full at 1440).
2. The Intro row reuses the Settings `row` and the `muted-foreground` token (docs/design.md); the value clamps to 2 lines, empty → "Not set". `ui-review` runs before push.
3. D37 lead = pure `siteLead(texts)` in `features/site/sample.ts`; `SiteProps.texts` → `HomeApi.lead`; `null` drops the lead and its gap. `DemoSite` passes the session texts.
4. Retire the old site: delete `site-photographer.tsx`; `site-viewer.tsx` keeps `Fullscreen`, its helpers and the `SiteState` seed type; `Std`'s default top becomes `TopBar`.
5. qa: the site smokes run on `personal-site` (room → Fullscreen → lightbox); photographer smokes go.

## Touch-set & Test Plan

| File                                       | Why                    |
| ------------------------------------------ | ---------------------- |
| `uikit/src/demo-parts/session.tsx`         | `site` texts           |
| `uikit/src/demo-parts/settings.tsx`        | Intro row              |
| `uikit/src/demo-parts/site.tsx`            | texts → `PersonalSite` |
| `uikit/src/features/site/sample.ts`        | `siteLead`             |
| `uikit/src/features/site/sys.tsx`          | `texts` prop           |
| `uikit/src/features/site/home.tsx`         | lead / no lead         |
| `uikit/src/features/site-viewer.tsx`       | cut to the lightbox    |
| `uikit/src/features/site-photographer.tsx` | deleted                |
| `uikit/src/features/parts.tsx`             | drop `PreviewTopBar`   |
| `uikit/src/features/pages.tsx`             | drop pages; Site notes |
| `uikit/src/kit/pages.json`                 | drop entries           |
| `uikit/src/features/site/art.tsx`          | comment                |
| `uikit/src/index.css`                      | comment                |
| `uikit/README.md`                          | lead rule              |
| `uikit/scripts/qa.mjs`                     | smokes                 |
| `e2e/kit-site-texts.spec.ts`               | new e2e                |

- Tests: e2e `kit-site-texts.spec.ts` (Intro row paint + "Not set", the three lead cases, room → Fullscreen → lightbox); uikit typecheck + qa.
