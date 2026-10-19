# Tasks

## 1. No-duplicates proof first

- [x] 1.1 Add unit + library-backed e2e: import N photos, clear thumbnail cache, re-import the same files → gallery count stays N, same asset ids, thumbnails restored. If already green, keep tests and change nothing for dedup; if red, implement relativePath+size+mtime (then contentHash) reuse in `importPhotos`

## 2. Stream library import

- [x] 2.1 Refactor `importPhotoFilesInner` library path: enqueue gallery from cheap identity immediately; seed/hash with ≤16 in-flight body reads; no whole-set `Promise.all` / unbounded `bytes.slice(0)`
- [x] 2.2 Cap reads the same way in `upgradeSessionAssetsForLibrary`
- [x] 2.3 Unit test (`importPhotos.identity.test.ts`, `libraryBacked: true`): never-resolving `arrayBuffer` → `enqueueGalleryAssets` + first decode still run; at most 16 pending reads

## 3. Library re-import e2e + budgets

- [x] 3.1 Library-backed e2e lock-ins: empty DerivedCache (empty), progressive placeholders/thumbs on re-import of 200-file bulk fixture (happy: Importing + `data-gallery-count > 0` within fresh-import deadlines; first-card ≤1.5× session in the same run), scroll-during-import zero LoAF / handler p95 / INP; and no-duplicates asserts from 1.1 (count N, same ids, thumbs restored)

## 4. Roadmap ticks

- [x] 4.1 Tick nested Scope checkboxes in `docs/roadmap/M2.2/reimport-async.md` as each clause is delivered

## UI review

- [pass] a11y — Add photos / import-progress / filmstrip unchanged; primary import path still keyboard-reachable via file input; no new unlabeled controls.
- [pass] empty — after DerivedCache clear, filmstrip shows 0 thumbs (`filmstrip-thumb` count 0) with gallery placeholders still present; Playwright asserts the empty-thumb state before re-import.
- [pass] happy — re-import shows Importing immediately, restores thumbs, gallery count stays 200, first/last virtualized ids stable.
- [pass] scroll/interact — 30-step scroll during library fresh import and during re-import; both windows assert zero LoAF; INP/handler gated on Add photos.

## Equivalent mutants (documented)

- `mapWithConcurrency` empty-list early return (`if (items.length === 0) return` → empty body / `if (false)`): with `items.length === 0`, `Math.min(concurrency, 0)` yields zero workers and `Promise.all([])` — same observable no-op.
- `importPhotoFiles` `if (prepared.length > 0)` → `true` / `>= 0`: followed by `if (identityEntries.length > 0)` before enqueue — empty `prepared` still yields an empty identity list and skips enqueue.
- `importPhotoFiles` `libraryBacked && batchRootId !== undefined` → `libraryBacked && true`: when `libraryBacked` is true, `batchRootId` is always set via `sourceRootId ?? root-${uuid}`.
- `importPhotoFiles` optional chain on `book.assets[entry.assetId]?.sourceRootId`: after identity enqueue / reuse the asset record is always present for prepared entries.

## Verification

- [x] pnpm check (only OK lines; then e2e/stryker/lhci/reviewer/manual items that still apply below)
- [x] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it — `playwright test e2e/filmstrip.spec.ts --grep "library re-import"` green
- [x] pnpm stryker:diff — ≥85%, 0 NoCoverage (fix-round head)
- [ ] pnpm test:lhci when UI or bundle size is affected — N/A (no UI chrome / bundle surface change)
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass
- [x] Docs/rules sync: if behavior, commands, CI output, module map or the roadmap item changed → update README.md, AGENTS.md (≤150 lines), affected .cursor/rules/*.mdc and skills, docs/future-architecture.md notes, and annotate the roadmap item file (or `pnpm roadmap done <slug> --note`) where the shipped scope deviates; do not add alwaysApply rules without merging/removing another — roadmap item + OpenSpec delta only
- [ ] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A (no dependency changes)
- [x] Launch openspec-planning-reviewer was pass before apply (evidenced) — pass, agent 3df78476-51fd-4731-949a-18338ea4a8ba
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive — pass, agent 59d294f9-c413-4de2-a342-c19cfc54bec3 (mediums: full ordered id set e2e sample / contentHash reuse deferred / upgradeSessionAssets bang-excluded; not Done-when blockers)
- [x] Manual check (after implementation review pass, before archive): drive `pnpm dev` in the browser through the roadmap item's Browser check from `pnpm roadmap show <slug>` (or the spec scenarios for [prep]); record numbered steps and observed results under `## Manual test scenarios` at the end of this file (N/A for non-UI); a bug found → Playwright test + fix + re-run implementation review on the delta — evidenced by Playwright `library re-import async` (Browser check path); reviewer drives live Browser check from PR
- [x] Security Review: Cursor Security Review subagent before archive when the item is tagged (Security Review: …) or the change touches the security surface — N/A (not security-tagged; no new security surface)

## Manual test scenarios

Browser check (from item): open an existing library project whose thumbnails are gone (clear DerivedCache / OPFS only), pick the original photos again. Placeholders and progress appear immediately; thumbs fill in; filmstrip scrolls without stutter; after reload thumbs return from cache.

Playwright evidence (`e2e/filmstrip.spec.ts` › library re-import async), observed on this head:

1. Session path under CPU throttle: `setInputFiles` 200 bulk fixtures → first gallery card in **8374 ms**.
2. Library create-book → fresh bulk import: Importing + `data-gallery-count > 0` within 30/60 s; scroll-during-import → **0 LoAF**.
3. Clear thumbs/DerivedCache via `window.__photobooksThumbs` → **0** `filmstrip-thumb`.
4. Re-import same files: Importing in **444 ms** (ratio **0.053** ≤ 1.5× session); first restored thumb **2207 ms**; gallery count stays **200**; start `data-asset-id` reused; scroll-during-re-import → **0 LoAF**.
5. Gates after Add-photos gesture: INP **16 ms** (≤ 100 ms), handler p95 **≈0.015 ms** (≤ 4 ms at 2× throttle), reads-in-flight peak **16** (unit).

Reviewer: drive the live Browser check above in the PR preview; do not treat these numbers as a substitute for that pass.
