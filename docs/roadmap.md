# Roadmap

Execution plan for the photobook editor. Architecture and decisions: `docs/future-architecture.md`.

## How to use

- Each top-level checkbox is **one OpenSpec change = one agent iteration = one PR**. The suggested change name is in backticks.
- Nested checkboxes are the scope of that change; tick them during apply. Do not pull scope from later items.
- Tags:
  - **[prep]** — groundwork with no new user-facing UI (pure modules, adapters, workers). Verified by tests.
  - **[feature]** — a visible change on the Cloudflare preview URL. The **Browser check** line describes what to verify.
  - **[contingency]** — a fallback for a gate owned by a named item; done only if that gate fails. When the gate-owning change is archived with the gate green, tick it as "not needed (gate passed in `<name>`)".
- **60 fps is part of done.** Every `[feature]` ships a perf scenario for the interaction it adds (gates in `docs/future-architecture.md`, "Performance model"); a regression blocks the PR. **Perf:** lines name the techniques the change must use. The **Browser check** includes watching the interaction for stutter (DevTools Performance panel, frame rendering stats). For features with an in-app scrollport, the Browser check also verifies no page-level H/V scroll — the named region is the scrollport (Playwright: `assertDocumentFitsViewport`).
- Milestones are review cuts: at the end of each, stop and review the product as a whole before continuing.
- Tick a top-level box only after the change is archived and the PR is merged. Exception: a `[contingency]` closed as "not needed" is ticked together with its gate-owning item.

### Change size

Every item fits one agent apply context. The limits (subsystems, implementation tasks, changed lines) live in `openspec/config.yaml` `rules.proposal`; a proposal over budget is split here before apply.

- A **subsystem** is a unit with its own lifecycle or contract: a worker or worker pool, a store, a painter or render layer, a storage or cache adapter, a new dependency, a new Vite entry, a schema version bump, a new top-level UI region (screen, panel, overlay layer). A UI region with its own view state is one subsystem; a dependency or worker that exists only to implement the item's one subsystem counts with it.
- Not a subsystem: new job types on the existing worker pool, ops / selectors / slices on an existing store, wiring existing subsystems into UI, the change's own perf scenario.

Slicing rules when adding or splitting items:

1. A `[feature]` adds at most one subsystem. If it needs both new non-UI infrastructure and a new UI region, the infrastructure is a preceding `[prep]`.
2. A book schema version bump is its own `[prep]`; pure functions over the new fields may ride along.
3. A gate fallback with its own scope (another painter path, streaming output) is a `[contingency]` item. A stop-and-re-plan condition or an in-place implementation choice (for example, "move serialization to the worker if over budget") stays inline.
4. Each split `[feature]` keeps its own **Browser check:** line, and a **Perf:** line with a scenario when it adds an interaction or background work the editor must stay smooth during.
5. Split only for a new subsystem or the task limit; small adjacent work stays merged.
6. The item that owns a gate referenced in `docs/future-architecture.md` keeps its name.

## Order

1. **M1–M4 — the local editor, complete for personal use.**
2. **M5 — the showcase site with books**, built and previewed locally.
3. **M6 — print.**
4. **M7 — deploy as my own site.**
5. **M8 — let others create their own books, sites and prints.**

## M0 — Foundation (done)

- [x] Tooling, CI quality gates, Cloudflare preview hosting, agent pipeline
- [x] Photo card: open one local image, EXIF-corrected preview in a worker
- [x] `raise-coverage-gates` — coverage gates hardening

## M1 — Editor skeleton

**Review cut:** the core editing loop works at 60 fps — add your photos to the filmstrip, drag them onto spreads on a zoomable pasteboard and back. Validates the document model, the shared renderer (including its pan/zoom performance) and drop semantics. Nothing is persisted yet.

- [x] [prep] `frame-budget-gates` — 60 fps measurement and gates (Security Review: headers)
  - [x] `src/perf/`: rAF frame-pacing sampler, Event Timing (INP) observer, `performance.measure` helpers for hot handlers; exposed via `__photobooksPerf`
  - [x] Playwright perf fixture: CDP CPU throttling, scenario windows, assertions (zero LoAF, INP, handler p95), frame stats as a CI artifact; throttling rate calibrated on CI runners
  - [x] `pnpm perf`: the same scenarios on a real machine with frame-pacing assertions
  - [x] Budgets in one config read by tests and benches
  - [x] Replace the 200 ms LoAF budget in `.cursor/rules/architecture.mdc`, `openspec/config.yaml` quality bar, `photo-card` spec, `react-perf-spa` skill, `LOAF_BLOCKING_BUDGET_MS`; add the 60 fps rule to `docs/lessons.md`
  - [x] Cross-origin isolation (COOP / COEP via Workers static-asset headers); verify `crossOriginIsolated` on the preview URL
  - [x] Enable React Compiler (or remove the assumption from `react-perf-spa`)
  - [x] Existing photo-card import scenario passes the new zero-LoAF gate
- [x] [prep] `book-core-schema` — pure book document in `src/core`
  - [x] Zod schema v1: book settings (trim size mm, bleed, safe margin), layout grid (margins, columns, rows, gutters) and guides (book-level, per-spread), assets, per-book gallery (ordered asset ids), spreads, frames (rect mm, z, assetId?, crop)
  - [x] Parse / serialize, `schemaVersion`, migration chain scaffold, reject newer versions
  - [x] Invariants: no dangling asset refs, every placed asset is in the gallery; PBT round-trip
  - [x] Immutable updates with structural sharing (unchanged spreads keep their reference)
  - [x] dependency-cruiser `core-is-pure`; update `.cursor/rules/data-model.mdc` and `AGENTS.md` module map
- [x] [prep] `layout-geometry` — templates, resolver, ops
  - [x] Templates as frame generators aligned to the layout grid: full-bleed spread, one per page, 2-up, 4-grid
  - [x] `resolveSpread` → resolved items with source crop rect; derived page cut lines; memoized by spread reference
  - [x] Pure ops: add to / remove from gallery (cascades placements), place, replace, unplace, swap, apply template, add / remove / move spread
  - [x] Selectors: placement count per asset, unplaced assets
  - [x] PBT for geometry and op invariants; `pnpm bench` budgets for resolve, ops and selectors on a 40-spread / 1000-asset book
- [x] [feature] `editor-shell-filmstrip` — editor layout and gallery
  - [x] Editor layout: workspace above, filmstrip below (replaces the single photo-card screen; update `photo-card` spec)
  - [x] Add a folder (directory picker, `webkitdirectory` fallback) or individual files; append to the gallery
  - [x] Asset worker pool: sized from `hardwareConcurrency`, priority queue (visible first), cancellation when a thumbnail scrolls away, transferables; folder scan and file reads inside the worker; per-file errors do not abort the batch; progress
  - [x] Horizontal virtualized filmstrip (React Aria GridList + Virtualizer); placeholders with aspect ratio first, thumbnails stream in
  - [x] Bounded object-URL LRU with revoke on eviction
  - **Perf:** pre-sized thumbnails only, `decoding="async"`, gallery updates batched per frame; scenario: import 200 photos while scrolling the filmstrip — zero LoAF.
  - **Browser check:** add a folder of 100+ photos, scroll the filmstrip during import without stutter; document does not grow H/V scrollbars; filmstrip is the horizontal scrollport; add more files later.
- [x] [prep] `spread-view-painter` — shared DOM painter
  - [x] `src/render/SpreadView` draws resolved items; empty frames show placeholders
  - [x] Per-spread store subscription (an edit re-renders one spread)
  - [x] Fixture book (~40 spreads × 4 photos) for painter tests and perf scenarios, loadable on the preview URL via a dev/test-only query parameter
- [ ] [feature] `pasteboard-workspace` — spreads on a pasteboard
  - [ ] Pasteboard: all spreads stacked vertically, off-screen spreads virtualized, active spread follows scroll
  - **Perf:** `contain` + `content-visibility` per spread, active-spread tracking via `IntersectionObserver` (no scroll-handler layout reads). Gate: fixture book (~40 spreads × 4 photos), scroll top to bottom — zero LoAF, frame pacing within budget; if it fails, stop and re-plan per "Painter risk" in `docs/future-architecture.md`.
  - **Browser check:** scroll through the fixture book like an InDesign pasteboard — no dropped frames; document does not grow H/V scrollbars; pasteboard is the vertical scrollport.
- [ ] [feature] `spread-templates-ui` — start a book
  - [ ] New book starts with a few spreads; choose a template per spread; add spread
  - **Perf:** a template switch re-renders only the affected spread.
  - **Browser check:** switch templates, add a spread — no dropped frames.
- [ ] [feature] `camera-zoom-pan` — zoom and pan
  - [ ] Ctrl/Cmd+wheel and pinch zoom around the cursor, `+` / `-`, fit spread, fit width, 100%; Space+drag pan; zoom indicator
  - **Perf:** camera is one `transform` written in rAF outside React; `will-change` only while zooming; zoom indicator updates through a narrow subscription. Gate: continuous zoom from whole book to 400% and back — zero LoAF, wheel handler p95 ≤ 2 ms. If whole-book zoom fails, do `far-zoom-lod`.
  - **Browser check:** zoom from the whole book to a single photo detail and back without stutter (images may stay soft until `zoom-image-tiers`).
- [ ] [feature] `zoom-image-tiers` — sharp images at every zoom
  - [ ] Zoom-aware image tiers: smallest preview covering on-screen size × DPR; worker generates tiers into a bounded in-memory LRU
  - **Perf:** tier switch after the gesture settles with `img.decode()` before swap. Gate: the `camera-zoom-pan` zoom scenario with tier switches — zero LoAF.
  - **Browser check:** zoom from the whole book to a single photo detail and back; images stay sharp, no flashes, no stutter.
- [ ] [contingency] `far-zoom-lod` — only if the `camera-zoom-pan` whole-book gate fails
  - [ ] LOD fallback: far-zoom spreads render as single worker-rasterized bitmaps (OffscreenCanvas from the same resolved items); only that zoom level swaps painter
  - **Browser check:** whole-book zoom holds the `camera-zoom-pan` gate.
- [ ] [feature] `drag-place-replace` — drop photos onto frames
  - [ ] Filmstrip → empty frame (place), → filled frame (replace)
  - [ ] "Placed" badge on filmstrip thumbnails; photo stays in the filmstrip after placing
  - [ ] Keyboard-accessible alternative for place and replace
  - **Perf:** native drag image; drop targets resolved from cached mm rects (no DOM queries in `dragover`); hover highlight toggles one attribute; one op per drop. Gate: drag across a zoomed-out book — zero LoAF, `dragover` p95 ≤ 2 ms.
  - **Browser check:** lay out a few spreads by hand; placed badges update; dragging stays smooth.
- [ ] [feature] `drag-swap-unplace` — rearrange and take back
  - [ ] Frame ↔ frame (swap / move), frame → filmstrip (unplace)
  - [ ] Keyboard-accessible alternative for swap, move and unplace
  - **Perf:** reuses the cached drop targets; one op per drop. Gate: drag a frame across a zoomed-out book — zero LoAF, `dragover` p95 ≤ 2 ms.
  - **Browser check:** drag photos back to the filmstrip, swap two frames; placed badges update; dragging stays smooth.

## M2 — Project on disk

**Review cut:** the book survives reloads, browser restarts and moved photo folders — and saving never causes a hitch.

- [ ] [prep] `library-storage` — book persistence contract
  - [ ] Domain-level `LibraryStorage` interface (no paths/bytes in its API); typed results (`permission-required`, `locked-elsewhere`, `not-found`, `corrupted`, `newer-schema`)
  - [ ] Memory adapter; one shared contract-test suite
- [ ] [prep] `library-storage-fsa` — library on the file system
  - [ ] File System Access adapter passing the shared contract suite
  - [ ] Library layout (`library.json`, `books/<id>/book.json`), writes via writable stream + `.bak` rotation, migrations on load
  - [ ] Load (parse, Zod, migrations) in a worker; serialization cost benchmarked on a 1000-asset book
- [ ] [prep] `session-state` — per-browser state
  - [ ] `SessionState` adapter: handles in IndexedDB, Web Locks per book
- [ ] [prep] `asset-record-schema` — asset identity in the document
  - [ ] Schema version bump with migration: asset record (source root, relative path, size, mtime, hash)
- [ ] [prep] `asset-identity` — content-addressed assets
  - [ ] `AssetSource` interface (read-only originals, folder scan) with memory and File System Access adapters
  - [ ] SHA-256 hashing in the worker at lowest priority; size + mtime fast path
  - [ ] Pure matching / relink function
- [ ] [prep] `derived-cache-opfs` — persistent preview cache
  - [ ] `DerivedCache` interface; OPFS adapter keyed by `(assetHash, presetId)`; zoom tiers and thumbnails move from the in-memory LRU to OPFS
- [ ] [feature] `open-save-project` — library on disk
  - [ ] Create / open library folder, create book; gallery and layout persist in `book.json`, added folders/files register source roots
  - [ ] Save (Ctrl/Cmd+S) and restore on reopen
  - **Perf:** serialization at background priority (worker if over budget). Gate: save during a drag — zero LoAF.
  - **Browser check:** build a book, save, reload the tab, reopen the folder — same book.
- [ ] [feature] `autosave` — never lose work
  - [ ] Debounced autosave, save indicator
  - **Perf:** autosave never runs during an active gesture; serialization at background priority (worker if over budget). Gate: continuous drag while autosave fires — zero LoAF.
  - **Browser check:** edit, reload without saving — changes are kept; editing never hitches on save.
- [ ] [feature] `permissions-locks-ux` — access and single writer
  - [ ] Permission re-grant flow; Web Locks single writer with a clear "open in another tab" message
  - **Browser check:** after a browser restart, access is re-granted in one step; a second tab is blocked from editing.
- [ ] [feature] `recents-home` — returning user
  - [ ] Home screen with books in the library and recent libraries (handles in IndexedDB)
  - **Browser check:** reopen the app; the home screen lists recent libraries and their books; one click opens a book.
- [ ] [feature] `missing-assets-relink` — moved photo folders
  - [ ] Missing-assets view; relink by rescanning a folder and matching hashes (scan and hashing in the worker)
  - **Perf:** rescan progress batched per frame. Gate: scroll the filmstrip while a rescan runs — zero LoAF.
  - **Browser check:** rename/move the photo folder, reopen, relink in one step, all photos restored; the UI stays responsive during the rescan.

## M3 — Building a real book

**Review cut:** you can assemble a complete real book from your own photos without reaching for InDesign, and a 1000-photo library feels instant.

- [ ] [feature] `document-history` — undo / redo
  - [ ] Snapshot history with op-key coalescing and size limit; transient state excluded
  - [ ] Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z, toolbar buttons
  - **Perf:** undo / redo is a pointer move over snapshots; only spreads with changed references re-render. Gate: hold Ctrl+Z through 50 steps — zero LoAF.
  - **Browser check:** apply a template, place and swap photos, undo/redo step by step; each drop is one step.
- [ ] [feature] `filmstrip-sort-filter` — working with the gallery
  - [ ] Sort (capture time, name, added order); filter "unplaced only"
  - [ ] Remove from gallery with a warning when the photo is placed
  - **Perf:** sort / filter via `startTransition`. Gate: 1000+ photo gallery scroll and filter toggle — zero LoAF.
  - **Browser check:** a 1000+ photo gallery scrolls smoothly; "unplaced only" shrinks as you lay out the book.
- [ ] [feature] `filmstrip-resize-drop` — filmstrip size and desktop drop
  - [ ] Adjustable filmstrip height / thumbnail size
  - [ ] Desktop files dropped on the filmstrip are imported
  - **Perf:** resizing the filmstrip resizes via `transform` / CSS variables during the drag and re-lays out the virtualizer at the end. Gate: resize the filmstrip while scrolled mid-gallery — zero LoAF.
  - **Browser check:** resize the filmstrip and thumbnails; drop files from the desktop and they append; no gaps in the scrolled filmstrip.
- [ ] [feature] `multi-drop-fill` — faster layout
  - [ ] Multi-select in the filmstrip; drop several photos on a spread fills its empty frames in gallery order
  - [ ] Drop between spreads creates a new spread with a fitting template
  - **Browser check:** select four photos, drop them on a 4-grid spread, all frames fill in order.
- [ ] [feature] `crop-in-frame` — non-destructive crop
  - [ ] Pan / zoom inside a frame (pointer, wheel, keyboard nudge), reset to cover
  - **Perf:** crop preview is a `transform` on the image in rAF; the crop op is committed at gesture end; a higher tier is requested when crop zoom exceeds the current tier. Gate: pan a crop for 5 s — zero LoAF, `pointermove` p95 ≤ 2 ms.
  - **Browser check:** reposition a photo inside its frame smoothly; reload keeps the crop.
- [ ] [feature] `spread-list-panel` — spread list (Google Slides style)
  - [ ] Left panel with spread thumbnails (same `SpreadView`, smallest tier, virtualized); click scrolls the pasteboard to the spread
  - [ ] Add / delete / duplicate spreads
  - **Perf:** thumbnails re-render only when their spread reference changes.
  - **Browser check:** click a thumbnail and the pasteboard scrolls to it; add, duplicate and delete spreads from the panel.
- [ ] [feature] `spread-reorder-retemplate` — reorder and re-template spreads
  - [ ] Reorder spreads by drag in the left panel
  - [ ] Switch a spread's template while keeping its photos
  - **Perf:** reorder drag moves thumbnails by `transform`.
  - **Browser check:** reorder spreads in the left panel; the pasteboard follows; switching templates keeps photos.
- [ ] [feature] `presentation-mode` — preview the book
  - [ ] Fullscreen, one spread at a time, arrow keys / click / swipe, Esc to exit, no editor chrome; same `SpreadView`
  - **Perf:** neighbouring spreads preloaded and decoded; transitions `transform` / `opacity` only. Gate: flip through 40 spreads quickly — zero LoAF, no blank frames.
  - **Browser check:** present the book fullscreen and flip through it like a finished album.
- [ ] [prep] `visual-regression-e2e` — screenshot tests (issue #8)
  - [ ] Playwright Docker parity, fixtures incl. EXIF-rotated and low-DPI photos, baseline spreads

## M4 — Grids, guides, free layout and text (local editor complete)

**Review cut:** the local editor is complete for personal use — grids and guides like InDesign / Affinity / Figma, layouts beyond templates, captions, precise control, all at 60 fps.

- [ ] [prep] `frame-transform-ops` — pure free-layout math
  - [ ] Move / resize / rotate ops; align / distribute
- [ ] [prep] `snapping-engine` — pure snapping
  - [ ] Snapping engine: trim / bleed edges, margins, grid columns / rows, guides, page center, other frames' edges and centers, equal gaps; returns corrected rect + active guide lines
  - [ ] Anchor index built once at gesture start; per-move query allocation-free; `pnpm bench` budget per query on a dense spread
- [ ] [feature] `layout-grid` — margins, columns, rows
  - [ ] Book setup panel: margins, columns, rows, gutters; optional per-spread override; templates re-align to the grid
  - **Browser check:** set a 12-column grid with margins; template frames follow the grid.
- [ ] [feature] `grid-overlay` — see the grid
  - [ ] Editor overlay layer above `SpreadView`; grid overlay with show / hide toggle
  - **Perf:** grid overlay is one SVG pattern per spread, not per-cell elements.
  - **Browser check:** toggle the grid on and off while scrolling and zooming; it stays aligned with template frames.
- [ ] [feature] `rulers` — mm rulers
  - [ ] mm rulers following the camera
  - **Perf:** rulers drawn on a `<canvas>` per camera frame. Gate: pan / zoom with rulers visible — zero LoAF.
  - **Browser check:** pan and zoom; ruler ticks stay aligned with the spread.
- [ ] [feature] `guides` — guides
  - [ ] Drag from a ruler to create a guide; move, delete, lock; numeric entry; book-level vs spread guides
  - [ ] Show / hide guides, snap on / off (view state)
  - **Perf:** guide drag is a `transform` in rAF, committed at gesture end.
  - **Browser check:** pull guides from both rulers, place one at an exact mm value, zoom — guides stay aligned with rulers.
- [ ] [feature] `frame-selection-handles` — direct manipulation
  - [ ] Select a frame; SVG handle overlay; move and resize by dragging
  - **Perf:** drag / resize preview in the overlay and on the frame's `transform`; op committed at gesture end. Gate: drag a frame across a dense spread — zero LoAF, `pointermove` p95 ≤ 2 ms.
  - **Browser check:** move and resize a frame with handles — handles never lag behind the cursor.
- [ ] [feature] `free-frames` — free layout
  - [ ] Add / delete frames, live snap lines to grid / guides / frames, detach spread from template
  - **Perf:** snapping via the anchor index. Gate: drag a frame across a dense spread with snapping on — zero LoAF, `pointermove` p95 ≤ 2 ms.
  - **Browser check:** draw a frame, snap it to a grid column and a guide, resize with handles — snap lines appear without lag.
- [ ] [feature] `inspector` — numeric properties
  - [ ] Position, size, rotation, crop, z-order, lock
  - **Perf:** inspector subscribes to the selection only; live values during a drag come from the transient gesture state, throttled to rAF.
  - **Browser check:** typing values moves frames precisely; values stay in sync with dragging.
- [ ] [prep] `text-frame-model` — text in the document
  - [ ] Schema version bump with migration: text frames; resolved text items
- [ ] [feature] `text-blocks` — captions
  - [ ] Text frames with inline editing
  - [ ] Bundled font files (later reused by the PDF painter)
  - **Perf:** fonts preloaded before first measure; typing re-renders only the edited text frame. Gate: type 200 characters fast — INP ≤ 100 ms.
  - **Browser check:** add a caption, edit it inline; it renders the same in the workspace and in spread thumbnails.
- [ ] [feature] `multi-select` — group operations
  - [ ] Shift / marquee selection, group move, align and distribute
  - **Perf:** marquee hit-test via the spatial index; group move is one `transform` per selected frame in rAF.
  - **Browser check:** select three frames and distribute them evenly; marquee over a full spread stays smooth.

## M5 — Showcase site with books (local)

**Review cut:** the showcase site with your books, previewed from the editor and exported to a folder, looks right and scrolls / swipes at 60 fps on a phone and on a 27″ 4K screen.

- [ ] [prep] `image-derivatives` — web image pipeline
  - [ ] Worker pool: resize presets from config, native JPEG / WebP encode, sRGB
  - [ ] Cache via `DerivedCache` by `(assetHash, presetId)`; benchmark
  - [ ] Derivative jobs at the lowest priority; scenario: edit with drag while derivatives encode — zero LoAF
- [ ] [prep] `avif-encoder` — AVIF derivatives (Security Review: dependency)
  - [ ] AVIF (multithreaded WASM, needs cross-origin isolation) + fallback where configured
  - [ ] Scenario: edit with drag while AVIF encodes — zero LoAF
- [ ] [prep] `publish-revisions` — draft vs published
  - [ ] `draft | published` status, frozen `published.json` revision, pure "assets needed for the site"
- [ ] [feature] `site-viewer` — viewer entry
  - [ ] Separate Vite entry: catalog, book page, spread navigation, `srcset`; captions via the same `SpreadView`
  - [ ] "Preview site" mode inside the app reading the current library
  - **Perf:** `content-visibility` for off-screen spreads; Lighthouse budgets for the viewer entry.
  - **Browser check:** preview the site from the editor; catalog → book → spreads; photos are light on mobile.
- [ ] [feature] `site-lightbox` — fullscreen and swipe
  - [ ] Fullscreen lightbox with CSS zoom; swipe between spreads
  - **Perf:** swipe and lightbox zoom `transform`-only, neighbours preloaded and decoded; mobile scenario with CPU throttling — zero LoAF.
  - **Browser check:** fullscreen photos are sharp on 4K, light on mobile; swiping is smooth on a phone.
- [ ] [prep] `static-export-core` — deterministic site tree
  - [ ] Prerendered HTML via `react-dom/server`, viewer bundle, derivatives, manifest; deterministic output
  - [ ] Only published books, using their frozen revision
- [ ] [feature] `static-export` — write `dist/`
  - [ ] Prerender and file writes in a worker; progress and cancel
  - **Perf:** scenario: edit with drag while the export writes — zero LoAF.
  - **Browser check:** export to a folder while continuing to edit without stutter, serve it locally, open on phone and desktop; drafts are absent.
- [ ] [feature] `derivative-tuning` — decide final sizes
  - [ ] In-app comparison page for size/quality presets on hard fixtures (sky gradients, shadows, foliage)
  - [ ] Record the chosen presets in config and spec
  - **Browser check:** compare 2K vs 4K and quality levels side by side; pick defaults.

## M6 — Print

**Review cut:** a PDF you can send to a print shop and a booklet you can print at home; exporting never freezes the editor.

- [ ] [prep] `print-profiles` — printer data and preflight
  - [ ] Profile schema (trim, bleed, safe margin, page-count rules, spine formula); book references a profile
  - [ ] Pure preflight: effective DPI, safe-zone intrusion, page-count rules
- [ ] [feature] `print-overlays` — see print constraints
  - [ ] Toggleable bleed / trim / safe overlays on the editor
  - **Browser check:** toggle the overlays; they align with frame edges at every zoom.
- [ ] [feature] `preflight-panel` — print warnings
  - [ ] Warnings panel with jump-to-spread
  - **Perf:** preflight recomputed per changed spread only, via `startTransition`.
  - **Browser check:** a low-resolution photo scaled up shows a DPI warning; clicking it jumps to the spread.
- [ ] [prep] `pdf-painter` — worker PDF painter (Security Review: dependency)
  - [ ] Worker PDF painter (maintained `pdf-lib` fork): original JPEG bytes, clip + transform crop, bleed, crop marks
- [ ] [feature] `pdf-export` — single-page print PDF
  - [ ] Progress, cancel, download
  - [ ] Peak memory measured on a 40-spread book against a recorded threshold; if above it, do `pdf-streaming`
  - **Perf:** scenario: edit while the PDF builds — zero LoAF.
  - **Browser check:** download the PDF; pages match the editor at trim size with bleed.
- [ ] [contingency] `pdf-streaming` — only if `pdf-export` peak memory is too high
  - [ ] Per-page chunks streamed to the file
  - **Browser check:** a 40-spread export's peak memory stays below the threshold recorded in `pdf-export`.
- [ ] [feature] `pdf-captions` — text in the PDF
  - [ ] Captions with the same embedded font files as the DOM painter
  - **Browser check:** captions in the PDF match the editor.
- [ ] [feature] `booklet-imposition` — home printing
  - [ ] Pure saddle-stitch sheet order with blank-page padding; imposed PDF from the page PDF (in the worker)
  - [ ] Duplex printing instructions
  - **Browser check:** print an 8–16 page booklet, fold, pages read in order.
- [ ] [prep] `cover-model` — cover in the document
  - [ ] Cover model (front / spine / back) with spine width from profile and page count (schema version bump)
- [ ] [feature] `cover-spine` — cover
  - [ ] Cover editing in the editor; cover PDF
  - **Browser check:** adding pages widens the spine; cover PDF dimensions match the profile.

## M7 — Deploy as my site

**Review cut:** your own live site with your books, updated incrementally from the editor.

- [ ] [prep] `hosting-decision` — spike
  - [ ] Verify Workers static-asset limits/terms vs R2 public bucket + custom domain; browser CORS options
  - [ ] Record the decision in `docs/future-architecture.md`
- [ ] [feature] `manual-deploy` — documented deploy path
  - [ ] Script deploying an exported `dist/` to your Cloudflare account (separate from the editor app)
  - **Browser check:** the exported site is live on its own URL.
- [ ] [feature] `publish-credentials` — connect the editor to your hosting (Security Review)
  - [ ] Locally stored, narrowly scoped credentials, entered from the existing export menu (no new panel); strict CSP
  - **Browser check:** enter credentials once; they survive a reload and are never sent anywhere except the hosting API.
- [ ] [feature] `in-app-publish` — publish button (Security Review)
  - [ ] Incremental upload by hash manifest from a worker; progress and retry
  - **Perf:** scenario: edit with drag while an upload runs — zero LoAF.
  - **Browser check:** change one spread, publish, only changed files upload, the live site updates; the editor stays smooth during upload.

## M8 — For others

**Review cut:** someone else opens the editor, makes a book, prints it and publishes their own site to their own account without touching code or config files.

**Re-plan:** at the M7 review cut; items are not yet sliced to the change budget.

- [ ] [prep] `publisher-targets` — generalize publishing
  - [ ] `Publisher` interface with target capabilities; the M7 path becomes one target
  - [ ] Contract tests shared by all targets
- [ ] [feature] `onboarding` — first run
  - [ ] Start screen explaining the flow, sample book, helpful empty states
  - **Browser check:** a fresh browser profile reaches a first laid-out spread without guidance.
- [ ] [feature] `connect-own-hosting` — bring your own hosting (Security Review)
  - [ ] Guided connection of the user's own Cloudflare account with minimal scopes; automatic provisioning of site and storage
  - **Browser check:** with a new Cloudflare account, connect and publish a site in one guided flow.
- [ ] [feature] `site-settings` — personalize the showcase
  - [ ] Site title, author, about page, theme choice
  - **Browser check:** change the title and theme; the preview and the published site update.
- [ ] [feature] `printer-presets` — print for everyone
  - [ ] Catalog of common print-shop profiles plus a custom profile editor
  - **Browser check:** pick a preset, export a PDF that matches its spec.

## Deferred (not scheduled)

- Rating / reject culling (the gallery itself is the selection)
- HEIC input (libheif WASM), "consolidate originals" command, library export to a single archive
- PDF/X, ICC output intents, CMYK
- Additional publish targets beyond Cloudflare (GitHub Pages, S3, …)
