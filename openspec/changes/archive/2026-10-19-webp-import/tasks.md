# Tasks

## 1. Worker guard

- [x] 1.1 Wrap the size `exifr.parse` in `processPhotoRequest` so a throw yields `{}`; leave `createImageBitmap` errors uncaught by that guard
- [x] 1.2 Unit tests in `processPhoto.test.ts`: WebP + size-parse throw → `ok: true` with bitmap dimensions; `createImageBitmap` reject → `ok: false`

## 2. Fixtures

- [x] 2.1 Add `e2e/fixtures/write-sample-webp.mjs` (lossy + lossless landscape 3:2, plus truncated/corrupt WebP); wire into `ensurePhotoFixtures` / `photoFixturePaths`

## 3. e2e + roadmap

- [x] 3.1 `e2e/filmstrip.spec.ts`: import lossy+lossless WebP via `photo-file-input` — thumbs, gallery count, no `import-errors`, place one → `spread-frame-image` `naturalWidth > 0`; corrupt WebP shows import error
- [x] 3.2 Tick Scope / Done-when boxes in `docs/roadmap/M2.2/webp-import.md` only (do not edit the UI-kit / Size region owned by the docs PR)

## 4. Verification

- [x] pnpm check (only OK lines; then e2e/stryker/lhci/reviewer/manual items that still apply below)
- [x] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass
- [x] Docs/rules sync: if behavior, commands, CI output, module map or the roadmap item changed → update README.md, AGENTS.md (within agentRules.budgets), affected .cursor/rules/*.mdc and skills, docs/future-architecture.md notes, and annotate the roadmap item file (or `pnpm roadmap done <slug> --note`) where the shipped scope deviates; do not add alwaysApply rules without merging/removing another
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change
- [x] Launch openspec-planning-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] Manual check (after implementation review pass, before archive): drive `pnpm dev` in the browser through the roadmap item's Browser check from `pnpm roadmap show <slug>` (or the spec scenarios for [prep]); record numbered steps and observed results under `## Manual test scenarios` at the end of this file (N/A for non-UI); a bug found → Playwright test + fix + re-run implementation review on the delta
- [x] Security Review: Cursor Security Review subagent before archive when the item is tagged (Security Review: …) or the change touches the security surface

### Verification notes

- `pnpm check`: all OK (2026-10-19).
- Done-when (1) red-on-main: with `origin/main` `processPhoto.ts` swapped in, e2e `imports lossy and lossless WebP` failed; Playwright error-context listed `sample-lossy-3x2.webp: Unknown file format` and `sample-lossless-3x2.webp: Unknown file format` (`/tmp/webp-e2e-main.log` + `test-results/.../error-context.md`). Branch e2e green (3 passed).
- e2e: `filmstrip` empty + lossy/lossless WebP place + corrupt decode error — 3 passed.
- `pnpm stryker:diff`: score 88.81, 0 NoCoverage (`readExifImageSize.ts` 100%; processPhoto survivors reduced after strip byteLength asserts).
- lhci: N/A (no UI chrome or bundle-size change).
- audit:ci: N/A (no package.json/lockfile change).
- Security Review: N/A (not security-tagged; no new FS/blob/CSP/dependency surface).
- Docs/rules: roadmap item Scope ticks only; no README/AGENTS/rules updates required.
- ui-review: no new chrome; empty/happy/interact locked by e2e; scroll N/A.

### Equivalent survivors (processPhoto.ts, score already ≥85)

Orientation short-circuit / `translateValues` boolean mutants in `readOrientation`, and cover-scale `maxEdge * longEdge` when the cover test already asserts `scale === maxEdge/longEdge`. MIME strip mutants are killed via decode-blob `byteLength` asserts (JPEG shrinks, WebP unchanged) — not claimed equivalent.

## Manual test scenarios

Browser check (`pnpm exec vite` on :5179, Chromium via Playwright; 2026-10-19):

1. Start session from home → `editor-shell` visible.
2. Add photos: lossy + lossless `.webp` fixtures → `data-gallery-count=2`, 2 thumbs, `import-errors=0`.
3. Place one WebP in a frame → `spread-frame-image` `naturalWidth=30`.
