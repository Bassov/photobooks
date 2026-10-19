# Future architecture notes

Target product architecture and the technical decisions behind it. Do not implement these in drive-by changes — each piece lands through an OpenSpec change listed in `docs/roadmap.md`.

## Product shape

- Local-first photobook editor in the browser (Chromium-first; HTTPS required for File System Access).
- **One document, three outputs:** the editor view, a static showcase site, and a print PDF are all rendered from the same book model.
- **60 fps, no main-thread stutter** in every interaction is a product requirement, not a polish item (see "Performance model").
- Personal tool first: the local editor is completed before any output. Then the showcase site, then print, then deploying the author's own site. Letting others create their own books, sites and prints on their own accounts comes last (`docs/roadmap.md`, M8); no shared hosting is ever provided.

## Core decision: one geometry resolver, thin painters

The editor, the site, and print MUST NOT each re-implement layout.

- `src/core/` owns all layout math as pure functions: `resolveSpread(book, spreadId, profile)` returns a flat list of resolved items (rect in mm, asset id, source crop rect, rotation, z-order) plus derived page cut lines.
- Painters only draw resolved items:
  - **DOM painter** (`SpreadView`) — shared by the editor and the static site (site HTML via `react-dom/server`).
  - **PDF painter** — print output, runs in a Web Worker.
- Editor-only affordances (selection handles, guides, print overlays) are a separate SVG/DOM overlay layer above the DOM painter, never part of the resolved output.
- Known divergence risk: text metrics differ between DOM and PDF. Mitigate with a narrow text feature set and the same font files for both outputs.

## Performance model (60 fps)

Hard product requirement: every interaction runs at 60 fps with no main-thread stutter — import, filmstrip scroll, pasteboard scroll, zoom / pan, drag, crop, typing, presentation, and the editor while export / publish runs in the background. Every optimization technique is in scope; the rules below are the defaults, not the ceiling.

### Frame budget

- A frame is 16.7 ms. During continuous gestures the main thread gets ≤ ~8 ms of script + style + layout per frame; the rest belongs to browser paint and composite.
- Hot-path handlers (`pointermove`, `wheel`, `dragover`) ≤ 2 ms each. Discrete actions (click, drop, key) reach the next paint within 100 ms (INP ≤ 100 ms).
- Nothing on the main thread is O(library size) or O(file size) during an interaction.

### Thread ownership

| Thread                   | Owns                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Main                     | React UI, DOM painter, input handling, light store updates                                                                      |
| Compositor (browser)     | Camera transform, scrolling, `transform` / `opacity` animations                                                                 |
| Raster threads (browser) | Decoding pre-sized previews for `<img decoding="async">`                                                                        |
| Worker pool              | Folder scan, file reads, EXIF, decode, resize, hashing, encode (JPEG / WebP / AVIF), book parse and migrations, PDF, imposition |

### Input and gestures

- Gestures (camera, frame drag, crop pan, guide drag, marquee) keep transient state outside React and write it straight to `transform` on one element inside `requestAnimationFrame`. React does not re-render per `pointermove` / `wheel`. The document op is committed once at gesture end (one history entry).
- Layout is read (`getBoundingClientRect`) only at gesture start. Hit-testing, drop targeting and snapping use cached mm rects and a spatial index — never DOM queries in a hot handler, never read-after-write layout thrash.
- Passive listeners everywhere except where `preventDefault` is required (Ctrl/Cmd+wheel zoom); pointer capture for drags; gallery → canvas uses native drag-and-drop, so the drag image is drawn by the browser.
- Hot paths allocate nothing per event (reuse rect / anchor objects) to avoid GC pauses mid-gesture.

### Rendering

- Never put originals in the DOM — only pre-sized previews from the cache, `decoding="async"`.
- Pasteboard and lists are virtualized; each spread gets `contain: layout paint style` and `content-visibility: auto` with an intrinsic size.
- Animate only `transform` / `opacity`. `will-change` only during an active gesture (permanent layer promotion costs GPU memory). No large `filter`, `backdrop-filter` or blurred shadows on the pasteboard.
- Zoom tier switch: while zooming, current images just scale; after the gesture settles, the next tier is decoded with `img.decode()` and swapped in (no flash, no decode at swap).
- Presentation and site navigation preload and decode the neighbouring spreads before they are shown.
- Rulers are drawn on a `<canvas>` once per camera frame, not as DOM ticks.
- LOD fallback if the DOM painter fails the gate at whole-book zoom: far-zoom spreads render as single worker-rasterized bitmaps (OffscreenCanvas from the same resolved items). Only that zoom level swaps painter; geometry stays.

### React and state

- External store with fine-grained selectors: changing one frame re-renders only that frame's spread. `resolveSpread` is memoized by spread reference (structural sharing makes reference equality reliable).
- Non-urgent updates (gallery sort / filter, template switch on many spreads, panel thumbnails) go through `startTransition` / `useDeferredValue`.
- React Compiler: enabled via `@vitejs/plugin-react` `compiler: true` (`oxc-transform-react`); `react-perf-spa` assumes it.
- Unavoidable main-thread loops are chunked with `scheduler.yield()` (fallback: `MessageChannel`), ≤ 5 ms per chunk.

### Workers

- One pool sized from `navigator.hardwareConcurrency` (leave one core for main), with a priority queue: visible thumbnails > visible zoom tiers > prefetch > hashing > derivatives / export. Jobs are cancellable (`AbortSignal`) when their target scrolls away.
- Transfer, don't clone: `ArrayBuffer`, `ImageBitmap`, `OffscreenCanvas`; directory / file handles are passed to workers so scanning and reading never touch main. Workers return encoded blobs for the cache, not raw pixels.
- Book load (JSON parse, Zod, migrations) runs in a worker. Autosave serialization runs at background priority (`scheduler.postTask`) and moves to the worker if it measures over budget.
- Cross-origin isolation (COOP / COEP headers) unlocks `SharedArrayBuffer`, multithreaded WASM (AVIF encode) and high-resolution timers for perf tests. Headers are security surface — Security Review.

### Memory

- Bounded LRU for object URLs and decoded tiers; revoke on eviction. Virtualization unmounts off-screen images so GPU memory stays flat on long books.
- Peak memory of import, export and PDF is bounded (streaming / per-page), not proportional to the whole book.

### Loading

- Separate editor and site entries; heavy workers (PDF, AVIF WASM) and late panels load lazily on first use. Lighthouse CI budgets (`budget.json`) per entry.

### Measurement and gates

Shared CI runners have no GPU and noisy CPUs, so they cannot prove 60 fps directly. CI gates on deterministic proxies; frame pacing is measured on a real machine.

| Gate                                | Where                                           | Threshold (calibrated in `frame-budget-gates`)      |
| ----------------------------------- | ----------------------------------------------- | --------------------------------------------------- |
| LoAF during an interaction scenario | Playwright in CI, CDP CPU throttling            | Zero entries (LoAF reports frames > 50 ms)          |
| Hot handler time                    | `performance.measure` in scenarios              | p95 ≤ 2 ms                                          |
| INP (Event Timing API)              | Playwright in CI                                | ≤ 100 ms                                            |
| Frame pacing (rAF sampler)          | `pnpm perf` locally; report-only artifact in CI | p95 frame ≤ 16.7 ms, dropped frames ≤ 2%            |
| Pure hot paths                      | `pnpm bench`                                    | Per-function budgets (resolve, snap, op, selectors) |
| Load                                | Lighthouse CI                                   | `budget.json`                                       |

- Every `[feature]` change ships a perf scenario for the interaction it adds; a regression blocks the PR.
- The former "LoAF `blockingDuration` ≤ 200 ms" budget was replaced by this model in `frame-budget-gates` (`src/perf/budgets.ts`).

## Target module map

| Module         | Responsibility                                                                                                             | Purity                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `src/core/`    | Book schema (Zod), migrations, document ops, templates, geometry, preflight, imposition order                              | Pure; no React/DOM/platform |
| `src/render/`  | `SpreadView` DOM painter shared by editor and site                                                                         | React, no platform I/O      |
| `src/editor/`  | Pasteboard + camera, rulers, grid/guide overlays, spread list, filmstrip, drag-and-drop, presentation mode, history wiring | UI                          |
| `src/project/` | `LibraryStorage` and `SessionState` adapters (memory, File System Access, IndexedDB, Web Locks)                            | Platform                    |
| `src/assets/`  | `AssetSource`, `DerivedCache`, import, hashing, previews, derivatives (workers). Grows out of today's `src/photo/`         | Platform + workers          |
| `src/print/`   | PDF worker, imposed PDF                                                                                                    | Worker                      |
| `src/site/`    | Viewer entry (separate Vite entry), static export writer                                                                   | UI + platform               |
| `src/publish/` | Deploy adapters                                                                                                            | Platform                    |

dependency-cruiser: `core-is-pure` (core imports nothing from UI/React/platform modules); `render` must not import `project`/`publish`.

## Document model

- **Spreads are the editing surface; pages are derived.** Items live in spread coordinates; single first/last pages are one-page spreads. Panoramas across the gutter need no special case. Do not store both `pages[]` and `spreads[]`.
- **The frame is the only layout primitive.** A template is a pure function that generates frames for a spread; the spread keeps an optional `templateId` so it can be re-applied. Free-form frame editing comes later without a schema break.
- **Crop is non-destructive and resolution-independent:** `{ zoom ≥ 1, center: { x, y } }` in normalized source coordinates, relative to "cover" fit. Survives swapping originals for previews or derivatives.
- **Physical units (mm)** in the document. Screen zoom is camera state, never document geometry.
- **Layout grid and guides are document data** (book level, optional per-spread override); see "Grids and guides".
- **Per-book gallery (working set):** each book stores an ordered list of asset ids the user added (a folder or individual files, appended over time). Placing a photo does not remove it from the gallery; one asset may be placed several times. Not every gallery photo ends up in the book. Invariant: every placed asset is in the gallery; removing an asset from the gallery also removes its placements (UI warns first).
- **No denormalized counters** (used/unused, placement counts) in the document — compute them with selectors.
- **Versioning:** integer `schemaVersion`, chain of pure migrations, Zod parse at every load boundary. Refuse to open a newer `schemaVersion` instead of trying to preserve unknown fields.
- **No `File` / `Blob` / handles** in the document (see `openspec/specs/book-core/`). Assets are referenced by id.
- Required invariants (property-based tests): save → load round-trips losslessly; no op leaves a dangling asset reference; undo after do restores the previous document.

## Editor layout

References: InDesign / Affinity Publisher (pasteboard, guides), Google Slides (spread list + presentation), Figma (layout grids, zoom).

- **Pasteboard workspace:** all spreads stacked vertically on a zoomable, pannable surface (`SpreadView` per spread + overlay layer). Off-screen spreads are virtualized.
- **Camera** (session state, never in the document or history): zoom via Ctrl/Cmd+wheel, pinch, `+` / `-`; fit spread, fit width, 100% (physical size); pan via scroll and Space+drag; zoom level indicator.
- **Zoom-aware image tiers:** each placed image uses the smallest cached preview that covers its on-screen size × devicePixelRatio, so zooming in stays sharp and zooming out stays light. Tiers switch after the gesture settles (see "Performance model"). Hot object URLs stay in a bounded in-memory LRU; when `contentHash` is known, tier (and thumbnail) bytes also persist in `DerivedCache` (OPFS).
- **Left panel:** spread thumbnails (same `SpreadView`), reorder by drag, click to scroll the pasteboard.
- **Bottom filmstrip:** the book's gallery (horizontal, virtualized, adjustable height / thumbnail size).
- **Presentation mode:** fullscreen, one spread at a time, arrow keys, no editor chrome. Same `SpreadView`; the site viewer later reuses it.
- **Painter risk:** the DOM painter on a transformed pasteboard must hold 60 fps pan / zoom for ~40 spreads, from a single-photo detail up to the whole book. This is verified by the perf gates in `pasteboard-workspace` and `camera-zoom-pan`; if they fail, apply the LOD fallback first (`far-zoom-lod`), then swap only the painter (the geometry resolver stays).

## Grids and guides

- **Layout grid (document):** book-level margins, columns, rows and gutters in mm (Figma layout grids / InDesign margins and columns), with an optional per-spread override. Templates generate frames aligned to the layout grid.
- **Guides (document):** horizontal / vertical guides in spread coordinates, created by dragging from rulers or by numeric entry; movable, deletable, lockable. Book-level guides apply to every spread.
- **Rulers:** mm rulers on the workspace edges following the camera; origin at the top-left trim corner of the active spread.
- **Visibility and snapping toggles** (show grid, show guides, snap on/off) are view state, not document state.
- **Snapping engine (pure, `src/core`):** input is a moving rect and a set of anchors; output is the corrected rect plus active guide lines. Anchors: trim and bleed edges, margins, grid columns/rows, guides, page center, other frames' edges and centers, equal gaps. The same function serves pointer drag, keyboard nudge and the numeric inspector.
- Grids, guides and rulers are editor-only overlays; they never appear in the site or print outputs.

## Drop semantics

- Drop semantics (each is one history entry, each has a keyboard alternative):

  | From → to                       | Result                                           |
  | ------------------------------- | ------------------------------------------------ |
  | Gallery → empty frame           | Place                                            |
  | Gallery → filled frame          | Replace; the replaced photo stays in the gallery |
  | Frame → frame                   | Swap (move if the target is empty)               |
  | Frame → gallery                 | Unplace; the photo stays in the gallery          |
  | Several gallery photos → spread | Fill the spread's empty frames in gallery order  |
  | Desktop files → gallery         | Import and append to the gallery                 |

- Rating / reject culling is not a core workflow: the gallery itself is the selection. Filters (unplaced only) and sorting (capture time, name, added order) cover the need.

## State and history

- Document ops are pure: `apply(doc, op) → doc` in `src/core`.
- History is a bounded stack of immutable document snapshots (structural sharing makes each snapshot cheap). Continuous gestures (drag, crop pan) coalesce into one entry via an op key.
- Transient UI state (hover, selection, camera, in-flight drag) lives outside the document and outside history.
- UI binding: a tiny external store (`useSyncExternalStore` or Zustand) with fine-grained selectors. No undo middleware library.
- Undo / redo is a pointer move over existing snapshots — no deep clone, no re-parse.

## Project storage

- **Library folder** (chosen by the user) holds all books so the site export can build a catalog:

  ```text
  <library>/
    library.json            # library + site settings
    books/<bookId>/book.json
    books/<bookId>/book.json.bak
    books/<bookId>/published.json   # frozen published revision
  ```

- **Originals are referenced, not copied** by default (copying doubles a photo archive). A later "consolidate" command may copy them.
- **Asset identity:** SHA-256 of content (computed in a worker) plus a source-root id, relative path, size and mtime for fast matching. The hash enables automatic relink after folders move.
- **Writes:** `FileSystemWritableFileStream` already writes to a swap file and commits on `close()`; add `.bak` rotation, not a temp-file dance.
- **Single writer:** Web Locks API per book so two tabs cannot overwrite each other.
- **Browser state is disposable:** IndexedDB (`idb-keyval`-level, no Dexie) for directory handles, recents and UI prefs; OPFS for thumbnail/derivative cache keyed by asset hash. Everything there must be rebuildable from the library folder.
- **Open/save (editor):** `src/editor/projectSession.ts` wires create/open library, create book, Ctrl/Cmd+S, and restore when the remembered library handle is still granted. Open of an existing library with an empty editor loads a stored book (preferring contentful books over an empty `session-book` placeholder); create still adopts the in-memory book. Photo-folder `AssetSource` handles stay in-session; after reload, document + DerivedCache hydrate, full original reattach is `missing-assets-relink`.

### Storage boundaries

The app depends on domain-level interfaces only; file layout, format, `.bak` rotation, atomic writes, schema migration on load, permissions and locks are adapter internals. Swapping JSON for another format must not touch code above `src/project/` / `src/assets/`.

| Interface        | Owns                                                       | Lifecycle                   |
| ---------------- | ---------------------------------------------------------- | --------------------------- |
| `LibraryStorage` | `library.json`, `book.json`, published revisions           | Source of truth, read/write |
| `AssetSource`    | Reading originals from photo folders, hashing, relink scan | Read-only, own permissions  |
| `DerivedCache`   | Previews and derivatives keyed by `(assetHash, presetId)`  | Disposable, rebuildable     |
| `SessionState`   | Directory handles, recents, UI prefs, Web Locks            | Disposable, per browser     |

- Interfaces speak domain types (`listBooks`, `loadBook(id)`, `saveBook(book)`), never paths or bytes.
- Platform conditions surface as typed results, not exceptions leaking API details: `permission-required`, `locked-elsewhere`, `not-found`, `corrupted`, `newer-schema`. Domain insert conflicts use `already-exists`.
- Each interface has a memory adapter and a browser adapter; both run the same contract-test suite. UI and e2e scenarios may use the memory adapters.

## Image pipeline

- All decode/resize/encode in Web Workers (existing `photo.worker` grows into the prioritized, cancellable asset worker pool — see "Performance model").
- Asset identity hashing runs at the lowest import priority: size + mtime match first, SHA-256 later in the background, so hashing never delays visible thumbnails.
- Decode: `createImageBitmap`; resize: OffscreenCanvas; JPEG/WebP encode: native `convertToBlob`; AVIF: WASM encoder (e.g. `@jsquash/avif`) in a worker.
- Site derivatives are a config, not code: `sizes` (start 400 / 2000 / 3840 long edge) and quality. Final sizes are decided by viewing tests on phone and 27″ 4K.
- One modern format (AVIF) plus a fallback only where it matters (likely the screen size) — do not double every size by default.
- Convert to sRGB for the web. HEIC input needs a WASM decoder (libheif) — deferred.
- Derivative cache key: `(assetHash, presetId)` → incremental export and publish.
- Keep `exifr` (MIT) for metadata.

## Print

- PDF built in a worker with a maintained `pdf-lib` fork: original JPEG bytes are embedded as-is (no recompression); crop via clip path + transform matrix. Non-JPEG/PNG sources are transcoded in the worker.
- **Imposition is post-processing:** a pure function computes sheet order (saddle-stitch first), and the imposed PDF is assembled from the per-page PDF via page embedding. Page-count padding to multiples of 4 is part of the pure function.
- **Printer profiles are data:** trim size, bleed, safe margin, page-count rules, spine-width formula (pages × paper caliper + board). Cover = front + spine + back resolved by the same geometry code.
- Preflight checks (effective DPI from crop zoom and frame size, safe-zone intrusion, page count) are pure functions in `src/core`.
- Memory risk: `pdf-lib` builds the whole document in memory, and embedding original JPEGs for a 40-spread book can reach hundreds of MB. Verify peak memory in `pdf-export`; if it is too high, build per-page chunks and stream them to the output file (`pdf-streaming`).
- Out of scope until real printer tests: PDF/X, ICC output intents, CMYK conversion.

## Static site

- The viewer is a separate Vite entry that renders `SpreadView` from exported data; export prerenders HTML with `react-dom/server` and copies the viewer bundle.
- Layout scales with container-relative units; images use `srcset`/`sizes` and `<picture>`; fullscreen lightbox uses the largest derivative with simple CSS zoom. No tile-based deep zoom.
- The site holds the same 60 fps bar on phones: swipe and lightbox zoom are `transform`-only, neighbouring spreads are preloaded and decoded, off-screen spreads use `content-visibility`.
- `draft | published` status plus a frozen published revision: editing a published book does not change the site until it is republished. Drafts never enter the export.
- Export output is deterministic (same input → same tree and file names) and is written to a user-chosen folder.

## Publishing

- First target: a manual path — export `dist/` and deploy with `wrangler` to the user's own Cloudflare account (a separate Worker/project from the editor app).
- In-app publishing is decided by a spike. Notes to verify: the Cloudflare REST API is not designed for browser CORS calls; R2's S3 API supports bucket CORS and SigV4 signing in the browser (`aws4fetch`). Credentials must be narrowly scoped, stored only locally, and paired with a strict CSP; that change needs a Security Review.
- Check Workers static-asset limits (files per version, file size) and terms for image-heavy sites before choosing "everything on Workers" vs "HTML on Workers + images on R2".

## Rejected or deferred alternatives

| Option                                  | Decision | Reason                                                                         |
| --------------------------------------- | -------- | ------------------------------------------------------------------------------ |
| Konva / Fabric canvas editor            | Rejected | Separate renderer from site/print; weaker text, a11y, DOM testing; bundle cost |
| Full canvas / WebGL editor painter      | Deferred | Only as LOD fallback for far zoom if the DOM painter fails the 60 fps gate     |
| tldraw / Polotno                        | Rejected | Production licensing; whiteboard/Canva model, not fixed print pages            |
| Sharp (Node) processing                 | Rejected | Breaks local-first and the worker rule; browser pipeline is sufficient         |
| Paged.js                                | Rejected | No flowing content; absolute layout goes straight to PDF                       |
| Uppy + presigned URLs                   | Rejected | Requires a signing backend, conflicts with bring-your-own-hosting              |
| Dexie                                   | Rejected | IndexedDB only holds disposable handles/prefs                                  |
| dnd-kit + TanStack Virtual + React Aria | Narrowed | Use React Aria collections, Virtualizer and DnD only                           |
| zundo                                   | Rejected | Pure ops + snapshot history are simpler and fully testable                     |
| Copy originals into the project         | Deferred | Optional "consolidate" command later                                           |
| Deep-zoom tiles                         | Rejected | 4K cap is enough for books                                                     |
| Multi-tenant hosting for others         | Rejected | Others bring their own hosting; their onboarding is the last milestone         |

## Visual regression e2e

Screenshot / `toHaveScreenshot` Playwright tests (Docker Playwright image parity, fixture photos including EXIF-rotated and low-DPI cases) are deferred until the M2.5 redesign settles (tracked in `docs/backlog/visual-regression-e2e.md`; screenshot baselines would churn on every redesign/feature PR).

Tracking issue: https://github.com/Bassov/photobooks/issues/8
