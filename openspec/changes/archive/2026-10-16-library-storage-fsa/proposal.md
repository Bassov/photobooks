# Proposal

## Problem

M2 needs a real library on disk. The domain `LibraryStorage` contract and memory adapter exist, but nothing yet maps them to a user-chosen folder via File System Access, so later open/save UI would invent layout, write safety, and load validation.

## Why now

Next unchecked roadmap item after `library-storage`. `open-save-project` and later M2 features depend on an FSA adapter that passes the shared contract suite and keeps parse/serialize off the interaction path.

## Scope in

- File System Access `LibraryStorage` adapter that passes the shared contract suite
- On-disk library layout with durable writes and `.bak` rotation; migrations on load via existing book parse
- Load (parse / validate / migrate) in a Web Worker; serialization cost benchmarked on a 1000-asset book
- Security surface: File System Access + worker `postMessage` of book documents

## Scope out

- Session handles, IndexedDB, Web Locks (`session-state`) — adapter may simulate `locked-elsewhere` for the contract suite only
- Open/save UI, autosave, permissions UX, recents home
- Asset identity / hashing, OPFS derived cache, publish revisions
- Schema version bumps beyond existing `book-core` migrations

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `library-storage`: File System Access adapter, on-disk library layout with durable writes, worker-backed load validation, and a serialization benchmark on a large book

## Success criteria

- FSA adapter passes every case in the shared `LibraryStorage` contract suite (same factory harness as memory)
- Durable library layout and `.bak` rotation are used for book writes; load applies migrations via existing book parse
- Book load parse/migrate runs in a worker (not on the main thread)
- Serialization of a 1000-asset book is benchmarked (`pnpm bench` or equivalent vitest bench) with a recorded budget
- No UI; `src/project` stays free of React

## Risks

- **Security:** FSA directory handles and worker messages carry user library JSON — keep handles/paths out of the domain API; do not post transferable handles to workers; treat parse failures as typed `corrupted` / `newer-schema` only
- Fake/in-memory FSA for Node tests may diverge from Chromium — keep the fake at the `FileSystemDirectoryHandle` boundary and add a thin real-API smoke later if gaps appear
- One-subsystem budget: FSA adapter (+ its worker) is the single new subsystem; no session/IDB
