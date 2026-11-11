## Implementation

- [x] 1. Port `site-book/**` and the `site/` renames from af8369bb; `box.ts`, `metaOf`, `base.css` — `uikit:typecheck`
- [x] 2. Hand edits (D35): `final` / Books switch / fold removed, test-id renames — `e2e/kit-personal-site*.spec.ts`
- [x] 3. "Site Inter Display" font-face + three opsz woff2 subsets — `kit-personal-site.spec.ts` Cyrillic `document.fonts.check`
- [x] 4. Kit page `personal-site` (pages.json, pages.tsx scenarios 1/3/6/12/30/100 via `BooksCount`) + router query split — `uikit:qa` 431/0
- [x] 5. Port demo-9 e2e to `e2e/kit-personal-site*.spec.ts` with the Spec checkpoints — `test:e2e:changed:quiet` OK
- [x] 6. qa.mjs site scans (sample cloth hue, site paper tint) — `uikit:qa` 431/0

## Manual test scenarios

1. Kit `#/full/personal-site?books=6` 1440×900: bookcase home, click a book → room, Play turns pages, All books returns.
2. 390×844: phone room opens in Page turn; swipe turns.

Kit-only PR: `pnpm agent manual-qa` drives the prod editor-shell, not the kit. Evidence instead:

- OK 1 — `e2e/kit-personal-site*.spec.ts` (home → room, foot row 846 / pager 720 / Play 1416, Pages 4–5 GL paint and θ 70° leaf; screenshot `gl-70.png` checked by eye)
- OK 2 — `kit-personal-site-room.spec.ts` phone page turn (header 128.25, stage 180.25)
- OK kit `uikit:qa` 431 passed / 0 failed, 0 console errors
