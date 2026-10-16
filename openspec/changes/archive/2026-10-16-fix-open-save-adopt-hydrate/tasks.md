# Tasks

## 1. Adopt UX + identity upgrade

- [x] 1.1 Auto-adopt after `createLibrary` / `openLibrary` / test attach when `bookId` is null; enable Save whenever library is open; Save/Ctrl+S adopts then saves when needed; confirm before destructive `createBookInLibrary` — verify unit tests for adopt-after-bind and confirm cancel; EditorShell wiring covered by e2e in 4.1
- [x] 1.2 Add `upgradeSessionAssetsForLibrary`: seed identity + hash for session Files missing identity; track hash jobs; call from adopt before createBook; `saveBookNow` awaits hash settle then writes once — verify unit: session import → adopt → assets have identity + contentHash; save waits for hashes

## 2. Put-after-hash + tier fallback + aspect

- [x] 2.1 Thumb/tier keep last buffers; on contentHash arrival put into DerivedCache (put-after-hash); import no longer races encode vs hash — verify unit: encode-before-hash → cache hit for `ensureThumb`
- [x] 2.2 `requestTier` falls back to thumb preset when File gone and tier miss — verify unit: placed tier URL hydrates from thumb entry
- [x] 2.3 On hydrate, restore aspect via JPEG `readJpegSofSize` or worker `processAsset` (no main-thread decode) — verify unit: landscape JPEG hydrate → aspect ≠ 1

## 3. E2E lock exploratory bugs

- [x] 3.1 Extend `e2e/open-save.spec.ts`: session import → attach library → Save without create-book → reload — thumbs + placed `img` visible; landscape not square-forced; New book confirm cancel; `assertDocumentFitsViewport` + `assertNamedScrollport` (filmstrip/pasteboard); keep existing New-book path green — verify `pnpm test:e2e`

## 4. Verification checklist

- [x] pnpm typecheck — green (`pnpm verify:fast`)
- [x] pnpm lint — green
- [x] pnpm test — green (606 tests)
- [x] pnpm test:e2e (or pnpm verify) — green (`CI=1` full suite 43 passed incl. open-save adopt/hydrate + New book confirm)
- [x] pnpm stryker:diff — 61.40% (≥ break 60; 666 killed / 34 timeout / 279 survived / 161 no-cov). Remaining: `projectSession` FSA/FileSystemDirectoryHandle + default storage branches no-cov in unit env (e2e OPFS); `bookStore` pre-existing flush/paint survivors outside this change; `thumbCache`/`tierCache` rAF flush / Blob mime equivalent under URL mocks; `importPhotos` decode/error paths equivalent under batch tests; `previewAspect` / `upgradeSessionAssets` / `EditorShell` excluded (JPEG SOF + adopt e2e / thin chrome)
- [x] pnpm test:lhci when UI or bundle size is affected — green
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass — empty: create/open visible, Save disabled; happy: session import → attach → Save without New book → reload thumbs + placed img + landscape orientation; interact: New book confirm cancel/accept; layout: `assertDocumentFitsViewport` + pasteboard `assertNamedScrollport`; a11y: labeled chrome + disabled states + polite status + confirm dialog; anti-slop: existing brand chrome unchanged
- [x] Docs/rules sync: main `editor-shell` spec synced; roadmap item owns this change; `stryker.mutate.md` excludes for previewAspect/upgradeSessionAssets; no AGENTS.md map change needed
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — clean (FSA security surface)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced: ffabe1d2)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive (evidenced: e7d5ca33 after put-await + checklist)
- [x] Manual check (after implementation review pass, before archive): drive `pnpm dev` in the browser through the roadmap item's Browser check (or the spec scenarios for [prep]); record numbered steps and observed results under `## Manual test scenarios` at the end of this file (N/A for non-UI); a bug found → Playwright test + fix + re-run implementation review on the delta
- [x] High-risk security surface: Cursor Security Review subagent before archive (evidenced: 24fa368f — no medium+ findings)

## Workflow follow-up

- Archive the change after implementation review + Manual check pass; sync delta specs; tick roadmap item.
- Commit, push, open PR, wait for CI green.

## Manual test scenarios

1. Open `/` — create/open visible; New book / Save disabled; no page H/V scroll.
2. Import photos (session), place one on a spread — filmstrip thumbs load; placement shows image.
3. Attach library via test seam / New library — status "Book created in library"; Save enables without clicking New book; gallery/placements unchanged.
4. Decline New book confirm — document unchanged. Accept New book confirm — empty book, status "Book created".
5. Session→attach→Save→reload (Playwright `e2e/open-save.spec.ts`): thumbs + placed frame image restored; landscape filmstrip orientation not square-forced; pasteboard viewport containment holds.
