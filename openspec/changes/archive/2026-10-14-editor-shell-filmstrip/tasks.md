# Tasks

## 1. Dependencies and scaffolding

- [x] 1.1 Add `react-aria-components` via pnpm; verify install and `pnpm audit:ci` clean for the bump
- [x] 1.2 Create `src/editor/` module skeleton (`EditorShell`, placeholders) and update `AGENTS.md` module map; verify typecheck sees the new path

## 2. Photo pool and LRU

- [x] 2.1 Implement bounded `objectUrlLru` with revoke-on-eviction; verify unit tests for get/set/evict/revoke
- [x] 2.2 Replace singleton worker with prioritized cancellable pool (visible-first, AbortSignal, transferables, batch `{completed,total,errors}`); verify unit tests with mocked worker edge
- [x] 2.3 Add folder/multi-file pick helpers (FSA preferred, `webkitdirectory` / multi `input` fallback); verify unit tests for accepted MIME filtering without aborting the batch on one bad file

## 3. Book store and session meta

- [x] 3.1 Implement `bookStore` (`useSyncExternalStore` + `applyBookOp`) with session aspect/dims map; verify unit tests for append gallery and session meta retention
- [x] 3.2 Wire import path: mint asset ids → `addToGallery` → enqueue thumb jobs; verify store+pool integration test through public APIs

## 4. Editor shell and filmstrip UI

- [x] 4.1 Build `EditorShell`: workspace placeholder, Add photos / Add folder, progress (`import-progress`), per-file errors (`import-errors`); verify component tests for progress and error visibility
- [x] 4.2 Build virtualized horizontal `Filmstrip` (GridList + Virtualizer); placeholders then `decoding="async"` thumbs from LRU; verify component test placeholder→thumb
- [x] 4.3 Mount shell from `App`; remove `PhotoCard` / `useOpenPhoto` primary path; verify knip/typecheck and smoke UI shows shell not photo-card

## 5. E2E and perf retarget

- [x] 5.1 Update/replace Playwright tests: import PNG, EXIF orientation thumb, TIFF-in-batch error, second import appends; verify `pnpm test:e2e` for those cases
- [x] 5.2 Add bulk ~200 import + filmstrip scroll LoAF scenario; point `pnpm perf` at it; verify CI gate helpers assert zero LoAF
- [x] 5.3 Tick nested `editor-shell-filmstrip` checkboxes in `docs/roadmap.md` as items land

## 6. Verification checklist

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify)
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected
- [x] Agent docs: if module map / commands / security surface / durable conventions changed → update AGENTS.md (≤150 lines); update .cursor/rules or skills only when a lasting convention changed; do not add alwaysApply rules without merging/removing another
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] High-risk security surface: Cursor Security Review subagent before archive

## Workflow follow-up

- Archive the change after implementation review and Security Review pass; sync delta specs into main specs.
- Tick top-level `editor-shell-filmstrip` in `docs/roadmap.md` only after the PR is merged.
