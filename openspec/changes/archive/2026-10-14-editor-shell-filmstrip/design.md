# Design

## Context

See proposal.md. `src/core` has gallery ops (`addToGallery`). `src/photo/` has a singleton worker and single-file picker. UI is photo-card-only in `App.tsx`. No `src/editor/` yet.

## Goals / Non-Goals

**Goals:** Editor shell + virtualized filmstrip; folder/multi-file import into an in-memory book; prioritized cancellable worker pool; bounded object-URL LRU; import progress/errors; retargeted LoAF e2e.

**Non-Goals:** Pasteboard/`SpreadView`, DnD place/replace, persistence/hashing/OPFS, filmstrip sort/filter.

## Decisions

1. **Modules**
   - `src/editor/` — `EditorShell` (import controls, progress, per-file errors), workspace placeholder, `Filmstrip`.
   - `src/editor/bookStore.ts` — `useSyncExternalStore` for `Book` via `applyBookOp`; session aspect/dims map keyed by asset id (not persisted in `book.json`).
   - Evolve `src/photo/` — worker **pool** (defer `src/assets/` to M2). Reuse `processPhoto` in workers. `objectUrlLru.ts` for create/get/revoke.
   - Remove primary use of `PhotoCard` / `useOpenPhoto` (delete or leave unexported dead code purged via knip).

2. **Pool** — Size `max(1, hardwareConcurrency - 1)`. Priority: visible filmstrip ids first. Jobs take `AbortSignal`; scroll-away cancels stale thumb work. **Enumeration:** browser `FileList`/`webkitdirectory` file refs may be listed on main; FSA directory iteration and all byte reads/decode/resize stay in workers. Per-file failures accumulate; batch continues. Batch state exposes `{ completed, total, errors[] }` for the shell.

3. **Import → document** — Mint ephemeral asset ids; `addToGallery`; write aspect/dims into the session map for placeholders and later `getAspectRatio`.

4. **Filmstrip** — `react-aria-components` GridList + Virtualizer, horizontal, with a fixed thumb cell and a windowed/revealed id list. During an active bulk import the gallery snapshot is frozen (previous assets stay visible; new ids mount after the batch) so GridList does not remount per chunk under CPU throttle; spacer width uses `importExpectedCount` so scroll still works. `decoding="async"`; thumb URL notify is per-asset.

5. **Progress / errors UI** — `EditorShell` owns progress (`data-testid="import-progress"`) and an alert list for per-file errors (`data-testid="import-errors"`), subscribed to pool batch state. Filmstrip stays scrollable during import.

6. **App / perf** — `App` mounts `EditorShell`. Replace photo-card LoAF e2e with bulk-import+scroll; update `pnpm perf` grep target.

## UI

- Labeled buttons: Add photos, Add folder; disabled while a blocking picker is open (not while background decode runs).
- Keyboard: buttons and GridList items focusable; virtualizer must not trap tab.
- States: empty filmstrip, importing (progress), per-file error, thumb loaded.
- Respect `prefers-reduced-motion` (no decorative motion required this change).
- Local-first chrome: brand + editor shell, not a marketing landing.

## Touch-set

- `src/editor/*` — shell, filmstrip, bookStore (+ session meta), styles
- `src/photo/` — pool, LRU, folder/file pick, warm/reset; retire `PhotoCard.tsx`, `useOpenPhoto.ts` (+ tests)
- `src/App.tsx`, `App.css`
- `e2e/` filmstrip scenarios + `pnpm perf`; reuse `ensurePhotoFixtures`
- `package.json` / lockfile (`react-aria-components`); `AGENTS.md`; roadmap nested ticks

## Composition

Shell: chrome + progress/errors. Filmstrip: virtualized gallery view. Store: book + session meta. Pool + LRU: thumbs only. Mutations only via `applyBookOp`.

## Tests

- Unit: LRU; pool priority/cancel (mock worker); store append + session meta.
- Component/e2e: placeholder→thumb; progress visible mid-import; TIFF-in-batch error; bulk ~200 + scroll LoAF via `e2e/perf` helpers.
- Public APIs / testids only; extend `photo.test-helpers` as needed.

## Security

- FSA pickers: user-gesture only; no handle persistence this change.
- Workers: structured messages + transferables; reset/terminate in tests.
- Object URLs from worker preview blobs only; revoke on LRU eviction and reset.
- Pin `react-aria-components`; `pnpm audit:ci`. Security Review before archive.

## Risks / Trade-offs

- [rAF-batched gallery updates] → slight lag; protects LoAF.
- [React Aria horizontal Virtualizer] → spike on apply; keep per architecture.
- [Main FileList enumeration] → refs only; bytes/decode in workers.

## Migration Plan

One PR replaces primary UI. Rollback = revert. No schema migration.
