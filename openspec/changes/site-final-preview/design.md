## Decisions

1. Reuse the P5 flags: `SitePreview` already passes `embedded`, `allBooks={false}`, `share={false}` and no site name; with `allBooks` off the room's head (`sb-back`) is a `<span>`, so D45 needs no `src/site/**` change. Lock it in tests: no link inside the room.
2. Paint check with `pixelsAt` (`e2e/fixtures/paintProbe.ts`): after one step the reader's page area under the 48 px bar must differ from the room background (non-blank page), plus `topAt` keeps the reader on top. DOM count alone is not enough (brief rule).
3. Leftovers: knip reports 0 unused files / exports; `git grep` finds no `SiteStage` / `SiteBookPage` / `siteViewer.css` code references. Only `src/site/SiteBookPage.embedded.test.tsx` keeps the old name → `git mv` to `SiteRoom.embedded.test.tsx` (content unchanged). `SiteCatalogBook` is a live type, kept. Stale "book page" wording in `SitePreview.tsx` docs and test titles → "room".

## Touch-set & Test Plan

| File                                    | Why                                           |
| --------------------------------------- | --------------------------------------------- |
| `src/editor/SitePreview.tsx`            | doc comment: room                             |
| `src/editor/SitePreview.test.tsx`       | room title, no link (plain head name)         |
| `src/site/SiteRoom.embedded.test.tsx`   | renamed from `SiteBookPage.embedded.test.tsx` |
| `e2e/site-preview-mode.spec.ts`         | plain head name, pixel paint check            |
| `docs/roadmap/P4/site-final-preview.md` | item filled from the brief                    |

- UI: no new tokens / primitives; existing `SiteRoom` styling.
- Reuse: `pixelsAt`, `topAt`, existing `openPreview` / `next` helpers.
- Tests: unit (SitePreview room, head is plain text); e2e (D45 controls, paint under the bar, Fullscreen → lightbox, Esc order, editor keys inert — existing). `SitePreviewBar.test.tsx` / `sitePreviewKeys.test.ts` already cover the unchanged keys rule.
