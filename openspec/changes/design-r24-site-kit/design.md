## Decisions

1. Start view 0 by default: `SysSite` defaults `start?.view` to 0, and browser Forward to a book hash opens at view 0. `startOf` (demo-parts) maps "no slide" to view 0 (Preview, `siteEntry=book`) and keeps slide s → view s + 1 for kit states that name a page.
2. Only a tap turns the cover: `Open.turn` is set by the home tap; `ReadingRoom` gets `turn` (default false) and runs the open-time cover turn only when it is set. A deep link, the Preview and Forward rest on the cover, like prod D41 / D42 / M53.
3. Kit registries: `uikit/scripts/qa.mjs` asserted the old Page 1 start in four checks (Preview view 1, → to view 2, D38 deep-link labels). They are updated to the cover start, since `uikit:qa:quick` gates CI. `pages.tsx` notes ("opens at page 1") stay as the brief forbids editing them; flagged in the PR.
4. No new tokens or primitives (docs/design.md untouched).

## Touch-set & Test Plan

| Path                                      | Why                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `uikit/src/features/site/sys.tsx`         | default view 0, `Open.turn`                                         |
| `uikit/src/features/site-book/room.tsx`   | `turn` prop gates the cover turn                                    |
| `uikit/src/demo-parts/site.tsx`           | `startOf` no slide → cover                                          |
| `uikit/scripts/demo-capture.mjs`          | editor-preview comment                                              |
| `uikit/scripts/qa.mjs`                    | four checks follow the cover start                                  |
| `e2e/kit-personal-site.spec.ts`           | new: direct link at 1440 / 390 rests on Cover; named slide opens it |
| `e2e/kit-personal-site-demo.spec.ts`      | Preview rests on Cover                                              |
| `e2e/kit-personal-site-room.spec.ts`      | phone specs turn from the Cover                                     |
| `e2e/kit-personal-site-reader-gl.spec.ts` | geometry specs turn to view 1 first                                 |
| `e2e/kit-preview-fold-strip.spec.ts`      | Preview paint spec turns to Page 1 first                            |
| `e2e/kit-preview-mod-arrows.spec.ts`      | starts on Cover                                                     |

- Reuse: `paintProbe.topAt` for the painted label.
- Tests: e2e only (kit; no `src/` code, so no unit / PBT).
