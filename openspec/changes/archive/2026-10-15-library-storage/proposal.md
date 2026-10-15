# Proposal

## Problem

M2 needs books to survive reloads, but nothing above `src/core` can list, load, or save library books yet. Without a domain `LibraryStorage` contract and a memory adapter, File System Access and UI would invent their own persistence APIs and typed failure shapes.

## Why now

First M2 item in `docs/roadmap.md`. Later prep (`library-storage-fsa`, `session-state`) and features (`open-save-project`) depend on one shared interface and one contract-test suite both adapters must pass.

## Scope in

- Domain-level `LibraryStorage` interface: library metadata and book CRUD in domain types only (no paths, bytes, or handles in the API)
- Typed results: `permission-required`, `locked-elsewhere`, `not-found`, `corrupted`, `newer-schema`, plus domain `already-exists` for insert conflicts
- In-memory adapter implementing the interface
- One shared contract-test suite that the memory adapter passes (FSA adapter deferred)

## Scope out

- File System Access adapter, library folder layout, `.bak` rotation (`library-storage-fsa`)
- Session handles, IndexedDB, Web Locks (`session-state`)
- Asset identity / hashing, OPFS derived cache
- Open/save UI, autosave, permissions UX
- Schema version bumps, migrations beyond what `book-core` already provides at parse

## Capabilities

### New Capabilities

- `library-storage`: domain persistence contract for libraries and books, typed storage results, and memory adapter verified by a shared contract suite

### Modified Capabilities

- (none)

## Success criteria

- Callers can list books, create/load/save/delete books, and read/update library metadata through `LibraryStorage` without seeing paths or raw bytes
- Every named typed result is produced by at least one contract-suite case on the memory adapter
- Memory adapter round-trips a valid `Book` losslessly through save → load
- Contract suite is reusable by a future FSA adapter without rewriting cases
- `src/project` stays free of React/DOM; no UI ships in this change

## Risks

- Over-specifying FSA-only behaviors in the interface would couple later adapters — keep results and methods to the roadmap list and domain types only
- Publishing revisions are owned by `LibraryStorage` long-term but out of this change; avoid inventing a publish API here
