## Decisions

1. Default view 0; `Open.turn`, set only by the home tap, gates the room's open-time cover turn. `startOf` maps "no slide" to the cover and keeps slide s → view s + 1.
2. `uikit/scripts/qa.mjs`: four checks asserted the old Page 1 start; they follow the cover start because `uikit:qa:quick` gates CI. `pages.tsx` notes stay (brief forbids edits), flagged in the PR.
3. No new tokens or primitives.

## Touch-set & Test Plan

| Path                                      | Why                            |
| ----------------------------------------- | ------------------------------ |
| `uikit/src/features/site/sys.tsx`         | default view 0, `Open.turn`    |
| `uikit/src/features/site-book/room.tsx`   | `turn` gates the cover turn    |
| `uikit/src/demo-parts/site.tsx`           | `startOf`: no slide → cover    |
| `uikit/scripts/demo-capture.mjs`          | editor-preview comment         |
| `uikit/scripts/qa.mjs`                    | checks follow the cover start  |
| `e2e/kit-personal-site.spec.ts`           | new: direct link, named slide  |
| `e2e/kit-personal-site-demo.spec.ts`      | Preview rests on Cover         |
| `e2e/kit-personal-site-room.spec.ts`      | phones turn from the Cover     |
| `e2e/kit-personal-site-reader-gl.spec.ts` | geometry turns to view 1 first |
| `e2e/kit-preview-fold-strip.spec.ts`      | paint turns to Page 1 first    |
| `e2e/kit-preview-mod-arrows.spec.ts`      | starts on Cover                |

- Tests: kit e2e only (no `src/`), reusing `paintProbe.topAt`.
