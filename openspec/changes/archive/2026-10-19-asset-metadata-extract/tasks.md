# Tasks

## 1. GPS policy (owner decision 2026-10-19)

- [x] 1.1 Update `book-core` main spec + `.cursor/rules/data-model.mdc`: remove GPS opt-in; allow `meta.gps` in the library document; SHALL that static export/publish strips GPS by default; delete any consent flag/path (no dead code)

## 2. Metadata extraction

- [x] 2.1 Add pure `src/assets/extractAssetMetadata` (`exifr`) mapping to schema fields including GPS when present; extend EXIF pick/schema as needed; unit tests on fixtures (omit absent fields; retain GPS without consent). Import/editor persistence writers stay out of scope
- [x] 2.2 Enqueue metadata extraction on the existing asset worker pool at `background` priority (worker calls the pure mapper); tests prove pool scheduling (background before hash) and worker-path result

## 3. Worker scanRoot

- [x] 3.1 Move `AssetSource.scanRoot` directory walk into a Web Worker for FSA + memory adapters; typed failures; no main-thread walk fallback; contract suite still green; test proves walk is not on the main thread

## 4. matchAssets status

- [x] 4.1 Extend `matchAssets` to report per-asset `ok | missing | modified` (same root+path + size/mtime differ → `modified` when hashes differ or either side lacks a hash); keep hash-prefer pairing; unit tests cover all three statuses

## 5. Docs / roadmap proof

- [x] 5.1 Tick Scope boxes on `docs/roadmap/M2.2/asset-metadata-extract.md` only when proven; close editor-shell-filmstrip shipped note (archive item note) when worker scan lands; sync AGENTS/module notes only if needed

## Verification checklist

- [x] pnpm check (only OK lines; then e2e/stryker/lhci/reviewer/manual items that still apply below)
- [x] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it — N/A (no UI)
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected — N/A
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass — N/A
- [x] Docs/rules sync: data-model.mdc GPS policy; roadmap Scope ticks; filmstrip shipped note closed; book-core + asset-source specs updated
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A (no dep changes)
- [x] Launch openspec-planning-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive (pass; low [repeat] GatedWorker helper → lesson 2026-10-19)
- [x] Manual check (after implementation review pass, before archive): N/A — prep, no Browser check
- [x] Security Review: Cursor Security Review subagent before archive when the item is tagged (Security Review: …) or the change touches the security surface — pass (no medium+ findings; GPS local-only intentional; export strip policy-only)

## Manual test scenarios

N/A — prep, no UI / no Browser check on the item.
