# Design

## Context

See proposal.md. `src/core` already owns `Book`, `parseBook` / `serializeBook`, and fixtures. No `src/project` yet; dependency-cruiser already forbids `render` → `project`. FSA / locks / UI are later roadmap items.

## Goals / Non-Goals

**Goals:** Domain `LibraryStorage` contract, typed results, memory adapter, shared contract suite, module map + cruiser alignment.

**Non-Goals:** Real FS, IndexedDB, Web Locks, publish revisions API, open/save UI, workers.

## Decisions

1. **Module layout** — New `src/project/`:
   - `types.ts` — `LibraryMeta`, `BookSummary`, result unions, `LibraryStorage` interface
   - `memory.ts` — `createMemoryLibraryStorage()` (+ test-only setters for permission/lock and raw seed)
   - `contract.test.ts` — suite parameterized by adapter factory
   - `index.ts` — public exports
   - Keep files small; no god-module.

2. **Domain surface** — Methods speak `Book` / library meta only:
   - `LibraryMeta` is a minimal placeholder `{ }` (empty object) until site settings land — **assumption**
   - `getLibrary` / `updateLibrary(meta)` — `updateLibrary` **replaces** the whole meta object (not deep-merge)
   - `listBooks` → summaries `{ id }` (title deferred until schema gains one — **assumption**)
   - `createBook(book)` — **insert-only**; if `book.id` already exists → `already-exists`
   - `saveBook(book)` — **update-only**; if id missing → `not-found`
   - `loadBook(id)` / `deleteBook(id)` — missing id → `not-found`
   - No paths, bytes, handles, or `File` on the interface.

3. **Typed results** — Discriminated unions `{ ok: true; ... } | { ok: false; code: ... }`. Platform/condition codes from the roadmap: `permission-required`, `locked-elsewhere`, `not-found`, `corrupted`, `newer-schema`. Domain conflict code: `already-exists` (create only). Prefer results over thrown platform errors at this boundary.

4. **Load validation** — Memory holds structured clones of `Book` for happy paths. Load runs through `parseBook` without changing `src/core`. Map parse codes at the adapter boundary only: `newer-schema` → storage `newer-schema`; `invalid-shape` and `invariant` → storage `corrupted`. Contract suite seeds opaque / newer-version payloads via a memory test hook (`seedRawBook`) — adapter-local, not on the domain interface.

5. **Simulated platform failures** — Memory adapter exposes `setPermissionRequired` / `setLockedElsewhere` for the contract suite. When permission is required, **every** method fails with `permission-required`. When locked elsewhere, **mutations only** (`createBook`, `saveBook`, `deleteBook`, `updateLibrary`) fail with `locked-elsewhere`; reads still succeed.

6. **Contract suite shape** — `runLibraryStorageContract(createStorage: () => LibraryStorage)` (or accept a richer factory that also returns test controls). Same file imported by memory tests now and FSA tests later.

7. **Cruiser / docs** — Extend `core-is-pure` so `src/core` cannot import `src/project`. Update `AGENTS.md` module map to point `src/project/` at `openspec/specs/library-storage/`.

## Touch-set

- `src/project/types.ts`, `memory.ts`, `index.ts`, `contract.test.ts` (+ thin `memory.test.ts` if needed to invoke the suite)
- `.dependency-cruiser.cjs` (core → project forbidden)
- `AGENTS.md` module map row
- `docs/roadmap.md` nested ticks for this item
- `openspec/specs/library-storage/` (via archive sync)

## Composition

`src/project` depends on `src/core` for `Book` / parse. Editor/UI must not land here. App may import `createMemoryLibraryStorage` for tests/e2e later; no UI wiring in this change.

## Tests

Public API under test: `LibraryStorage` via memory factory + contract suite. Reuse `makeBook` from `src/core/testing/fixtures`. No e2e / Playwright (prep, no UI). No Lighthouse unless bundle wiring appears (it should not).

## Risks / Trade-offs

- [Test hooks on memory] → Keep setters out of the domain interface; document them as adapter-local for the contract suite.
- [No book title in schema] → Summaries use id until a later schema change; recorded as assumption.
- [Publish revisions deferred] → Interface omits publish methods until a roadmap item needs them.

## Migration Plan

Additive module. Rollback = revert PR.
