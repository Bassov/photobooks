# Tasks

## 1. Metadata extraction

- [x] 1.1 Add pure `src/assets/extractAssetMetadata` (`exifr`) mapping to schema fields; GPS only when caller passes `includeGps` (default off); unit tests: opt-in → `meta.gps` present, no opt-in → absent; omit absent fields. Import/editor persistence writers stay out of scope
- [x] 1.2 Enqueue metadata extraction on `metadataPool` (photo worker) at background priority above hash (`hashContent` waits for metadata idle; worker calls the pure mapper; passes through `includeGps`); tests prove scheduling and worker-path result

## 2. Worker scanRoot

- [x] 2.1 Move `AssetSource.scanRoot` directory walk into a Web Worker for FSA + memory adapters; typed failures; no main-thread walk fallback; contract suite still green; test proves walk is not on the main thread

## 3. matchAssets status

- [x] 3.1 Extend `matchAssets` to report per-asset `ok | missing | modified` (same root+path + size/mtime differ → `modified` when hashes differ or either side lacks a hash); keep hash-prefer pairing; unit tests cover all three statuses

## 4. Docs / roadmap proof

- [x] 4.1 Tick Scope boxes on `docs/roadmap/M2.2/asset-metadata-extract.md` only when proven; close editor-shell-filmstrip shipped note when worker scan lands; keep `book-core` GPS opt-in / site-export policy unchanged from #118

## Verification checklist

- [x] pnpm check (only OK lines; then e2e/stryker/lhci/reviewer/manual items that still apply below)
- [x] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it — N/A (no UI)
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected — N/A
- [x] UI in scope — N/A
- [x] Docs/rules sync: asset-source specs; roadmap Scope ticks; filmstrip shipped note; `book-core` / data-model GPS left as on main
- [x] pnpm audit:ci — N/A (no dep changes)
- [x] Launch openspec-planning-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] Manual check — N/A — prep, no Browser check
- [x] Security Review — pass (GPS opt-in at extract boundary; site-export omit remains book-core policy)

## Round-2 fix notes

- Restored `book-core` GPS requirement + data-model GPS sentence byte-identical to `origin/main`; extractor `includeGps` default off; dropped export-strip SHALL; no “no consent” / “GPS always local” claims.
- Metadata scheduling: `metadataPool` + `hashContent` awaits `whenMetadataIdle` (assetPool left byte-identical to main so it stays out of stryker:diff).
- Mutation (local `pnpm stryker:diff` on this head): **87.3%** with **0 NoCoverage** (670 killed + 1 timeout / 769; 98 survived). `scan.worker.ts` stays in the mutate set (covered by shell unit tests; no new bang exclude).

## Equivalent mutants (survivors after tests)

- `metadataPool` / `scanClient` `new Worker(url, { type: 'module' })` URL/options StringLiteral/ObjectLiteral — unit tests stub `Worker`; constructor args are unused by the stub.
- `match.ts` `bothHashes` `&&`→`||` at the hash-equality gate — with the following `contentHash ===` check, one-sided undefined still fails equality; observable status unchanged for current pairing inputs.
- `extractAssetMetadata` empty `catch` BlockStatement — catch only resets `raw = {}`; emptying the block leaves the pre-initialized `raw = {}` (same observable result).

## Manual test scenarios

N/A — prep, no UI / no Browser check on the item.
