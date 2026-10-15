# Design

## Context

See proposal.md. `src/project` has `LibraryStorage`, memory adapter, and `runLibraryStorageContract`. Parse/serialize live in `src/core`. Layout rules: `docs/future-architecture.md` “Project storage”. No UI; security surface is FSA + worker messages.

## Goals / Non-Goals

**Goals:** FSA adapter, on-disk layout + `.bak` rotation, worker load, contract suite on FSA harness, serialize bench for 1000-asset book.

**Non-Goals:** Real Web Locks / IndexedDB / permission UI; publish revisions; schema bumps; open/save chrome.

## Decisions

1. **Modules** — `src/project/fsa/`: `memoryDirectory.ts` (Vitest FSA fake), `layout.ts` (paths + read/write), `bookLoad.worker.ts` + `bookLoadWorkerClient.ts`, `fsaLibraryStorage.ts` (`createFsaLibraryStorage({ root })`). Tests: `fsaLibraryStorage.test.ts`. Bench: `serialize.bench.ts`. Export from `src/project/index.ts`.

2. **Factory / harness** — Adapter-local `setPermissionRequired`, `setLockedElsewhere`, `seedRawBook` (raw JSON into fake tree). Permission/lock **simulated** until later UX/locks items — **assumption**.

3. **Layout / discovery / writes**
   - `library.json` = library meta only (not a book index). Missing → empty meta `{}`; create on `updateLibrary` / first write that needs it.
   - `listBooks` enumerates child directories under `books/` (id = directory name). Missing `books/` → `[]`.
   - Create: `getDirectoryHandle('books', { create: true })` then `getDirectoryHandle(bookId, { create: true })`, write `book.json`.
   - Save: if `book.json` exists, copy content to `book.json.bak`, then write new `book.json` via `createWritable()` → `write` → `close()`.
   - Payload: `JSON.stringify(serializeBook(book))`.
   - Delete: remove the book directory under `books/`.

4. **Worker load** — Main thread reads `book.json` **text** only and posts the string. Worker runs `JSON.parse` + `parseBook` (migrate/validate). Map failures to `corrupted` / `newer-schema`. Never transfer directory handles into the worker.

5. **Bench** — `largeBook(…, 1000)` + `serializeBook` time budget (same style as `ops.bench.ts`).

6. **Mutation** — Exclude `bookLoad.worker.ts` onmessage shell in `stryker.mutate.md` if it mirrors `photo.worker.ts`; keep client/layout/adapter in scope.

## Touch-set

`src/project/fsa/*`, `src/project/index.ts`, `src/project/fsaLibraryStorage.test.ts`, `src/project/serialize.bench.ts`, stryker exclude note if needed, archive sync of `library-storage`, nested roadmap ticks.

## Composition

`src/project/fsa` → `src/core` only. Callers use `createFsaLibraryStorage` from `src/project`; no React.

## Tests

Public API: `createFsaLibraryStorage` + contract suite. Fixtures: `makeBook` / `largeBook`. Extra cases for `.bak` and layout via adapter + fake directory reads. No e2e / UI / LHCI.

## Security

Handles stay adapter-internal. Worker messages: JSON text + parse result codes only (no handles/`File`). Platform permission → `permission-required` when detectable; else simulated until `permissions-locks-ux`. No CSP/COOP/COEP changes.

## Risks / Trade-offs

- [FSA fake ≠ Chromium] → API-compatible at methods we call; real-browser smoke later if needed.
- [Locks simulated] → Contract only; real locks in `session-state`.

## Migration Plan

Additive. Rollback = revert PR.
