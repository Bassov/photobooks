# Tasks

## 1. FSA test double and layout

- [x] 1.1 Add `src/project/fsa/memoryDirectory.ts` implementing the `FileSystemDirectoryHandle` / file-handle subset needed for library ops (getDirectoryHandle, getFileHandle, removeEntry, createWritable, text read); verify unit smoke that create → write → read round-trips a string
- [x] 1.2 Add `src/project/fsa/layout.ts` helpers for `library.json` and `books/<id>/book.json` (+ `.bak` rotation via writable commit); verify helpers create `books/` on demand and rotate bak on overwrite against the memory directory

## 2. Worker load and FSA adapter

- [x] 2.1 Add `bookLoad.worker.ts` + `bookLoadWorkerClient.ts`: main posts book JSON **string**, worker runs `JSON.parse` + `parseBook`, returns success book or `corrupted` / `newer-schema`; verify client unit test with a stubbed Worker (or vitest worker) for valid, corrupt, and newer-schema payloads
- [x] 2.2 Implement `createFsaLibraryStorage({ root })` with list from `books/` dirs, meta from `library.json`, create/save/delete + `.bak`, worker-backed load, adapter-local permission/lock/seed hooks; export from `src/project/index.ts`; verify create → save → load round-trip on the memory directory
- [x] 2.3 Wire `runLibraryStorageContract` for the FSA harness in `fsaLibraryStorage.test.ts`; verify `pnpm test` passes every typed failure case for FSA
- [x] 2.4 Add layout/bak-focused tests (create writes `books/<id>/book.json`; save leaves previous content in `.bak`; delete removes book dir; list ignores `library.json` book index); verify they pass

## 3. Bench and docs

- [x] 3.1 Add `src/project/serialize.bench.ts` serializing a 1000-asset book with a failing time budget; verify `pnpm bench` (or the project’s bench script) runs it green
- [x] 3.2 Exclude worker onmessage shell in `stryker.mutate.md` / `stryker.config.json` if needed; tick nested `library-storage-fsa` roadmap checkboxes as work lands; verify `pnpm verify:fast` mutation-scope passes

## 4. Verification checklist

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify) — green (1 flaky drag-place keyboard place, passed on retry)
- [x] pnpm stryker:diff — 76.01% (282 killed / 61 survived / 28 no-cov); score ≥ break 60. Added public-API coverage for browser-handle wrap, create-without-bak, library meta empty/non-object, worker error path. Remaining survivors: equivalent JSON.parse catch → parseBook(undefined) still `corrupted`; LibraryMeta placeholder makes empty/non-object meta branches observationally identical until site settings; defensive memoryDirectory path guards (empty segments / undefined fileName) unreachable via public layout API; shared-worker lazy init / listener cleanup equivalents in bookLoadWorkerClient; optional create/recursive option plumbing in handles wrap.
- [x] pnpm test:lhci when UI or bundle size is affected — N/A (no UI / no app entry wiring)
- [x] UI in scope: browser smoke evidenced … — N/A (prep, no UI)
- [x] Docs/rules sync: nested roadmap ticks; AGENTS.md already maps `src/project/` → library-storage; no README/future-architecture drift (layout already documented)
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — clean (FSA / worker security surface)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced: 6d9b896e)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive (evidenced: a853fa25 pass after correlation-id + default-worker-path fixes)
- [x] Manual check (after implementation review pass, before archive): N/A for non-UI [prep]; spec scenarios locked by FSA + memory contract suites and layout/worker tests (see Manual test scenarios)
- [x] High-risk security surface: Cursor Security Review subagent before archive (evidenced: 80f6f9a8 — no medium/high/critical findings)

## Manual test scenarios

N/A — [prep] with no UI. Spec scenarios observed via tests:

1. Empty library lists no books; getLibrary returns `{}` — `runLibraryStorageContract` (memory + FSA).
2. createBook → `books/<id>/book.json`; listBooks from `books/` dirs; save rotates `.bak`; delete removes book dir — FSA layout tests.
3. loadBook parse/migrate via worker (`postMessage` `{ id, text }`); corrupt → `corrupted`; newer schema → `newer-schema` — bookLoad + default-worker-path tests.
4. Typed failures: not-found, already-exists, permission-required (all ops), locked-elsewhere (mutations only) — contract suite on FSA harness.
5. serializeBook on 1000-asset book within budget — `src/project/serialize.bench.ts`.

## Workflow follow-up

- Archive the change after implementation review + Security Review pass; sync delta specs into main `openspec/specs/`.
- Commit, push, open PR; tick top-level `library-storage-fsa` on the same branch after archive.
