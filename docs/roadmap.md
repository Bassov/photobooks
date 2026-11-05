# Roadmap

Execution plan for the photobook editor. Architecture and decisions: `docs/future-architecture.md`.

This index and the item files under `docs/roadmap/` are the single source of truth for what gets built and in which order: issues, proposals and review notes are inputs until they land here. The UI kit **v0.10.0** (`uikit/`) is the UI/UX reference for roadmap items (screen / full / demo / feature routes), not a second plan.

Process: [roadmap/RULES.md](roadmap/RULES.md). One file per item: `roadmap/<milestone>/<slug>.md`. Retire a finished milestone with `pnpm roadmap archive <M>` (drops the index block and folder; git history is SoT). Change the index only with `pnpm roadmap` (`add` / `done` / `move` / `sync` / `archive`), never by hand.

## Order

Owner priorities (2026-10-29), kit **v0.10.0**:

1. **P1 — align the current editor to the kit.**
2. **P2 — add missing features iteratively** (kit-first).
3. **P3 — personal site.**
4. **P4 — print.**
5. **P5 — let other people make their own personal site** (kit-first).

Finished items are deleted from the index (git history is the record); M3 and M4 were retired. Items whose kit page was removed in v0.10 with no replacement, and kit-first items whose UI is absent from `uikit/src/sandbox` (Designer call B1, 2026-10-30), are held in `docs/backlog/`; Owner re-adds them with `pnpm roadmap add` once their kit page lands. "In the kit" means present in `uikit/src/sandbox` and wired into the `#/demo` editor, even if reachable only through a flag or shortcut (RULES.md); such items are scheduled with sandbox `file:line` refs and marked `kit: sandbox, not shown in #/demo` (Designer kit-first audit, 2026-10-30). Counts: P1 0 (all done; `archive P1` waits for its review cut), P2 12, P3 13, P4 10, P5 3 open (audit 2026-11-02, `roadmap-audit`); held in `docs/backlog/`: 3 kit-first (`guides-precise`, `kit2-undo-history` history list, `onboarding-others`) and 5 with their kit page removed (incl. `preflight-fixes`).

## P1 — Align the editor to the kit (v0.10.0)

**Review cut:** product screens look like kit v0.10.0 `#/demo`; stubs allowed, no fake controls. Done when: product screens match `#/demo` baseline steps 01–20, 23–26 and 39–49 by Designer review (21–22 land with P2 `parent-spreads`, 27–31 with P4 `pdf-export`, 32–38 with P3).

- [x] [feature] [design-r3-spread-shadow](roadmap/P1/design-r3-spread-shadow.md) — Bug: design-r3-spread-shadow: soft constant-px spread shadow (M35) + 72/588 stack gap (M36)
- [x] [feature] [fix-flaky-node-tests](roadmap/P1/fix-flaky-node-tests.md) — Bug: fix-flaky-node-tests: make 2 flaky node tests deterministic (root cause, no loosening)
- [x] [lite] [e2e-photo-fixture-race](roadmap/P1/e2e-photo-fixture-race.md) — Fix: e2e photo fixtures are rewritten while other workers import them
- [x] [feature] [design-r3-canvas-fit](roadmap/P1/design-r3-canvas-fit.md) — Bug: design-r3-canvas-fit: canvas Fit on spread change + click on a selected frame
- [x] [feature] [design-r4-polish](roadmap/P1/design-r4-polish.md) — Bug: design-r4-polish: drag hint, canvas-centred tool group, 31 px menu rows, sort dot, floor page-number rule
- [x] [feature] [design-r5-polish](roadmap/P1/design-r5-polish.md) — Bug: design-r5-polish: drag source keeps its photo, top-bar Library inset
- [x] [feature] [design-r7-canvas-chrome](roadmap/P1/design-r7-canvas-chrome.md) — Bug: design-r7-canvas-chrome: in-canvas chrome locked to zoom, no frame size pill
- [x] [feature] [design-r7-spreads](roadmap/P1/design-r7-spreads.md) — Bug: design-r7-spreads: single pages on their side, spread-list labels, new-spread drop pill and 104/588 gap
- [x] [feature] [design-r7-panels](roadmap/P1/design-r7-panels.md) — Bug: design-r7-panels: One per page layout, endpaper inspector top, filmstrip wheel, preview from cover, no inspector hide button
- [x] [feature] [design-r8-polish](roadmap/P1/design-r8-polish.md) — Bug: design-r8-polish: endpaper inspector spacing, single-page list rows, new-spread pill centring
- [x] [feature] [design-r9-letter-spacing](roadmap/P1/design-r9-letter-spacing.md) — Bug: design-r9-letter-spacing: uppercase section titles match the kit
- [x] [feature] [design-r10-chrome](roadmap/P1/design-r10-chrome.md) — Bug: design-r10-chrome: button font, layout picker and Create dialog match the kit
- [x] [feature] [design-r10-inspectors](roadmap/P1/design-r10-inspectors.md) — Bug: design-r10-inspectors: Cover/Book/Photo inspectors and segmented controls match the kit
- [x] [feature] [design-r10-library](roadmap/P1/design-r10-library.md) — Bug: design-r10-library: Welcome, Library and Settings match the kit
- [x] [feature] [design-r11-controls](roadmap/P1/design-r11-controls.md) — Bug: design-r11-controls: input font, secondary/pill buttons and Settings match the kit
- [x] [feature] [design-r11-topbar](roadmap/P1/design-r11-topbar.md) — Bug: design-r11-topbar: editor top bar controls match the kit
- [x] [feature] [cover-hires](roadmap/P1/cover-hires.md) — Bug: /next-roadmap-item cover-hires
- [x] [feature] [endpaper-hires](roadmap/P1/endpaper-hires.md) — Bug: /next-roadmap-item endpaper-hires
- [x] [feature] [design-r11-photo](roadmap/P1/design-r11-photo.md) — Bug: design-r11-photo: Photo inspector expanded sections match the kit
- [x] [feature] [design-r12-inspector](roadmap/P1/design-r12-inspector.md) — Bug: design-r12-inspector: Photo inspector field boxes, Caption offset and Crop "Done" button match the kit
- [x] [feature] [design-r11-canvas](roadmap/P1/design-r11-canvas.md) — Bug: design-r11-canvas: spine fold, spread-list thumbnail shadow and cover text match the kit
- [x] [feature] [design-r12-surfaces](roadmap/P1/design-r12-surfaces.md) — Bug: design-r12-surfaces: cover text positions, spread-list page cards and popover menus match the kit
- [x] [feature] [design-r13-polish](roadmap/P1/design-r13-polish.md) — Bug: design-r13-polish: book menu position and Caption section height match the kit
- [x] [feature] [design-r14-hide-framestyle](roadmap/P1/design-r14-hide-framestyle.md) — Bug: hide Frame style and Arrange in the Photo inspector (M78, Owner Q8)
- [x] [feature] [roadmap-audit](roadmap/P1/roadmap-audit.md) — Bug: /next-roadmap-item roadmap-audit
- [x] [feature] [import-relink-stall](roadmap/P1/import-relink-stall.md) — Bug: photo import stalls at 16 / 21 and a relink dialog opens during import
- [x] [prep] [decode-no-source-copy](roadmap/P1/decode-no-source-copy.md) — Decode worker: stop copying the original file to the main thread
- [x] [feature] [thumb-reload-cache-miss](roadmap/P1/thumb-reload-cache-miss.md) — Bug: gallery photos without a cached thumb stay gray after reload
- [x] [prep] [folder-manifest-batched-dims](roadmap/P1/folder-manifest-batched-dims.md) — Folder manifest: batch dimension patches, no lost updates
- [x] [prep] [decode-slot-busy-until-reply](roadmap/P1/decode-slot-busy-until-reply.md) — Decode pool: keep in-flight thumbs, never double-book a worker
- [x] [feature] [thumb-hot-cache](roadmap/P1/thumb-hot-cache.md) — Filmstrip: a thumb that loaded once never goes gray again
- [x] [prep] [thumb-scaled-decode](roadmap/P1/thumb-scaled-decode.md) — Decode thumbs with ImageDecoder at reduced scale
- [x] [feature] [thumb-bulk-hydrate](roadmap/P1/thumb-bulk-hydrate.md) — On book open, load all cached thumbs before the user scrolls
- [x] [feature] [perf-gate-short-loaf](roadmap/P1/perf-gate-short-loaf.md) — Bug: /next-roadmap-item perf-gate-short-loaf
- [x] [contingency] [thumb-pack-storage](roadmap/P1/thumb-pack-storage.md) — Store a folder's thumbs in one IndexedDB store (only if hydrate is slow)
- [x] [feature] [thumb-background-warm](roadmap/P1/thumb-background-warm.md) — Thumbs for the whole folder in the background
- [x] [feature] [thumb-warm-slice](roadmap/P1/thumb-warm-slice.md) — Bug: /next-roadmap-item thumb-warm-slice
- [x] [prep] [rescan-cheap-verify](roadmap/P1/rescan-cheap-verify.md) — Folder rescan on open: no per-file re-resolve, O(n) diff, parallel scan

## P2 — Missing features, iterative

**Review cut:** features removed or held in kit v0.10 come back one by one; items whose UI is in the kit sandbox carry sandbox refs (`rulers`, `guides`, `dpi-badge`, `text-blocks`, `live-captions`, `parent-guides`, `parent-overrides`, `page-numbers`); P1 `kit10-demo-expose-hidden` makes the hidden ones visible in `#/demo`. Only UI absent from the sandbox stays held in `docs/backlog/` until Designer adds the kit page. Owner and Designer decide the order.

- [x] [feature] [framestyle-arrange-unhide](roadmap/P2/framestyle-arrange-unhide.md) — Show Frame style and Arrange in the Photo inspector again, kit look (M78)
- [x] [feature] [arrange-lock](roadmap/P2/arrange-lock.md) — stacking and locking
- [x] [feature] [multi-select](roadmap/P2/multi-select.md) — group operations
- [x] [feature] [multi-select-move](roadmap/P2/multi-select-move.md) — group move
- [x] [feature] [multi-select-marquee](roadmap/P2/multi-select-marquee.md) — marquee selection
- [x] [feature] [locked-frame-swap](roadmap/P2/locked-frame-swap.md) — Bug: /next-roadmap-item locked-frame-swap
- [x] [feature] [unsupported-browser](roadmap/P2/unsupported-browser.md) — Bug: /next-roadmap-item unsupported-browser
- [x] [feature] [multi-select-inspector](roadmap/P2/multi-select-inspector.md) — multi-selection inspector: align, distribute, arrange, delete
- [x] [feature] [inspector-empty-after-grey](roadmap/P2/inspector-empty-after-grey.md) — Bug: /next-roadmap-item inspector-empty-after-grey
- [x] [feature] [settings-books-count-flash](roadmap/P2/settings-books-count-flash.md) — Bug: /next-roadmap-item settings-books-count-flash
- [ ] [feature] [text-blocks](roadmap/P2/text-blocks.md) — captions
- [ ] [feature] [live-captions](roadmap/P2/live-captions.md) — captions from photo metadata
- [x] [feature] [frame-styles](roadmap/P2/frame-styles.md) — consistent frames across the book
- [x] [prep] [parent-spreads-schema](roadmap/P2/parent-spreads-schema.md) — parent spreads in the document
- [x] [feature] [filmstrip-stuck-thumbs](roadmap/P2/filmstrip-stuck-thumbs.md) — Bug: after a fling back and forth some filmstrip tiles never get a thumb
- [x] [feature] [warm-slice-scheduler-loaf](roadmap/P2/warm-slice-scheduler-loaf.md) — Bug: CI perf red on main (thumb warm slice / bulk hydrate fling LoAF)
- [x] [feature] [layout-picker-simplify](roadmap/P2/layout-picker-simplify.md) — Simpler Layout picker in the spread inspector (Owner product decision 2026-11-02)
- [x] [lite] [worker-ctx-trim](roadmap/P2/worker-ctx-trim.md) — worker-ctx-trim: compact preflight output and a short must-read for unattended workers
- [x] [lite] [worker-batch-tool-calls](roadmap/P2/worker-batch-tool-calls.md) — worker-batch-tool-calls: headless workers send independent tool calls in one message
- [x] [feature] [parent-spreads](roadmap/P2/parent-spreads.md) — parent spreads
- [x] [feature] [parent-spreads-edit](roadmap/P2/parent-spreads-edit.md) — parent spreads: edit in Masters mode
- [x] [prep] [perf-baseline-aware](roadmap/P2/perf-baseline-aware.md) — Bug: perf lane — a scenario red on main does not fail PRs that leave it alone
- [x] [feature] [editor-hidpi-photos](roadmap/P2/editor-hidpi-photos.md) — Bug: photos in the book editor look soft on 4K / HiDPI screens and visibly upgrade after a drop
- [x] [feature] [filmstrip-appledouble-skip](roadmap/P2/filmstrip-appledouble-skip.md) — Bug: filmstrip gray tiles from `._*` AppleDouble files; decode-failed photos return as blank tiles after reload
- [x] [feature] [kit-sync-canvas](roadmap/P2/kit-sync-canvas.md) — Bug: Kit sync W1: canvas strip, page numbers, new-spread pill, size pill, K1 (Designer kit-sync Spec)
- [x] [feature] [photo-slot-stretch](roadmap/P2/photo-slot-stretch.md) — Bug: a photo in a frame is stretched instead of cover-cropped
- [x] [feature] [layout-tile-states](roadmap/P2/layout-tile-states.md) — Bug: Layout tiles: hover/selected on the paper, thumb box follows the trim
- [x] [feature] [prod-kit-fixes](roadmap/P2/prod-kit-fixes.md) — Bug: prod differs from kit in 3 places (Designer kit-sync Spec P1–P3)
- [x] [feature] [kit-sync-book](roadmap/P2/kit-sync-book.md) — Kit sync W4: pastedown caption, cover inspector, library card title
- [x] [lite] [rig-bump-0-2-21](roadmap/P2/rig-bump-0-2-21.md) — rig-bump-0-2-21: bump ts-agent-rig to v0.2.21 (compact preflight run card)
- [x] [feature] [remove-cursor-support](roadmap/P2/remove-cursor-support.md) — Bug: /next-roadmap-item remove-cursor-support
- [x] [feature] [parent-spreads-inspector](roadmap/P2/parent-spreads-inspector.md) — parent spreads: master inspector (grid, guides, items)
- [x] [feature] [parent-spreads-inspector-guides](roadmap/P2/parent-spreads-inspector-guides.md) — parent spreads: master guides and rulers on the master canvas
- [x] [feature] [layout-grids-parent-inherit-core](roadmap/P2/layout-grids-parent-inherit-core.md) — Bug: /next-roadmap-item layout-grids-parent-inherit-core
- [x] [feature] [parent-spreads-perf](roadmap/P2/parent-spreads-perf.md) — parent spreads: edit perf gate
- [x] [feature] [kit-sync-chrome](roadmap/P2/kit-sync-chrome.md) — Bug: Kit sync W2: top-bar view toggles, no Add spread row, Preview = presentation mode (Designer kit-sync Spec)
- [x] [feature] [kit-sync-filmstrip](roadmap/P2/kit-sync-filmstrip.md) — Bug: Kit sync W5: filmstrip header Unplaced toggle + sort menu (Designer kit-sync Spec)
- [x] [feature] [design-r16-prod](roadmap/P2/design-r16-prod.md) — Bug: /next-roadmap-item design-r16-prod
- [x] [feature] [design-r16-kit-inspector](roadmap/P2/design-r16-kit-inspector.md) — Bug: /next-roadmap-item design-r16-kit-inspector
- [x] [feature] [kit-sync-inspector](roadmap/P2/kit-sync-inspector.md) — Bug: kit sync W3 — inspector head, layout picker, flip icons, page size chevron
- [x] [feature] [layout-grids-parent-inherit](roadmap/P2/layout-grids-parent-inherit.md) — grids on parent spreads
- [x] [feature] [parent-realign-gaps](roadmap/P2/parent-realign-gaps.md) — Bug: /next-roadmap-item parent-realign-gaps
- [x] [feature] [design-r17](roadmap/P2/design-r17.md) — Bug: /next-roadmap-item design-r17
- [x] [feature] [design-r16-kit-book](roadmap/P2/design-r16-kit-book.md) — Bug: /next-roadmap-item design-r16-kit-book
- [x] [feature] [site-photographer-demo](roadmap/P2/site-photographer-demo.md) — Bug: /next-roadmap-item site-photographer-demo
- [x] [feature] [parent-overrides-core](roadmap/P2/parent-overrides-core.md) — Bug: /next-roadmap-item parent-overrides-core
- [x] [feature] [parent-overrides-canvas](roadmap/P2/parent-overrides-canvas.md) — Bug: /next-roadmap-item parent-overrides-canvas
- [x] [feature] [text-frames-core](roadmap/P2/text-frames-core.md) — Bug: /next-roadmap-item text-frames-core
- [x] [feature] [text-frames-kit](roadmap/P2/text-frames-kit.md) — Bug: /next-roadmap-item text-frames-kit
- [x] [feature] [text-frames-editor](roadmap/P2/text-frames-editor.md) — Bug: /next-roadmap-item text-frames-editor
- [x] [feature] [parent-guides-kit](roadmap/P2/parent-guides-kit.md) — Bug: /next-roadmap-item parent-guides-kit
- [x] [feature] [roadmap-index-no-tick](roadmap/P2/roadmap-index-no-tick.md) — Bug: /next-roadmap-item roadmap-index-no-tick
- [x] [feature] [tab-leaves-presentation](roadmap/P2/tab-leaves-presentation.md) — Bug: /next-roadmap-item tab-leaves-presentation
- [x] [feature] [thumb-warm-memo](roadmap/P2/thumb-warm-memo.md) — Bug: /next-roadmap-item thumb-warm-memo
- [x] [feature] [roadmap-tick-tidy](roadmap/P2/roadmap-tick-tidy.md) — Bug: /next-roadmap-item roadmap-tick-tidy
- [x] [feature] [master-spread-both-pages](roadmap/P2/master-spread-both-pages.md) — Bug: /next-roadmap-item master-spread-both-pages
- [x] [feature] [default-master](roadmap/P2/default-master.md) — Bug: /next-roadmap-item default-master
- [x] [feature] [kit-thumbgrid-page-select](roadmap/P2/kit-thumbgrid-page-select.md) — Bug: /next-roadmap-item kit-thumbgrid-page-select
- [x] [feature] [prod-arrange-rulers-parity](roadmap/P2/prod-arrange-rulers-parity.md) — Bug: /next-roadmap-item prod-arrange-rulers-parity
- [x] [feature] [kit-focus-ring-style](roadmap/P2/kit-focus-ring-style.md) — Bug: /next-roadmap-item kit-focus-ring-style
- [x] [feature] [parent-guides](roadmap/P2/parent-guides.md) — guides on parent spreads
- [x] [feature] [parent-guides-snap](roadmap/P2/parent-guides-snap.md) — Bug: /next-roadmap-item parent-guides-snap
- [x] [feature] [parent-guides-prod-overhang](roadmap/P2/parent-guides-prod-overhang.md) — Bug: /next-roadmap-item parent-guides-prod-overhang
- [ ] [feature] [parent-overrides](roadmap/P2/parent-overrides.md) — change one spread without touching the parent
- [ ] [feature] [page-numbers](roadmap/P2/page-numbers.md) — page numbers
- [x] [feature] [page-numbers-kit](roadmap/P2/page-numbers-kit.md) — Bug: /next-roadmap-item page-numbers-kit
- [x] [feature] [page-numbers-core](roadmap/P2/page-numbers-core.md) — Bug: /next-roadmap-item page-numbers-core
- [ ] [feature] [user-templates](roadmap/P2/user-templates.md) — your own layouts

## P3 — Personal site

**Review cut:** your own live site with your books: viewer, lightbox, preview, publish, site and hosting settings, at 60 fps on a phone and a 27″ 4K screen.

- [x] [prep] [image-derivatives](roadmap/P3/image-derivatives.md) — web image pipeline
- [ ] [prep] [avif-encoder](roadmap/P3/avif-encoder.md) — AVIF derivatives (Security Review: dependency)
- [x] [prep] [publish-revisions](roadmap/P3/publish-revisions.md) — draft vs published
- [x] [feature] [user-templates-store](roadmap/P3/user-templates-store.md) — Bug: /next-roadmap-item user-templates-store
- [ ] [feature] [user-templates-picker](roadmap/P3/user-templates-picker.md) — Bug: /next-roadmap-item user-templates-picker
- [ ] [feature] [user-templates-best-fit](roadmap/P3/user-templates-best-fit.md) — Bug: /next-roadmap-item user-templates-best-fit
- [ ] [feature] [site-viewer](roadmap/P3/site-viewer.md) — viewer entry
- [x] [feature] [site-viewer-render](roadmap/P3/site-viewer-render.md) — Bug: /next-roadmap-item site-viewer-render
- [x] [feature] [site-viewer-kit](roadmap/P3/site-viewer-kit.md) — Bug: /next-roadmap-item site-viewer-kit
- [ ] [feature] [site-preview-mode](roadmap/P3/site-preview-mode.md) — preview the site from the editor
- [ ] [feature] [site-lightbox](roadmap/P3/site-lightbox.md) — fullscreen and swipe
- [x] [prep] [static-export-core](roadmap/P3/static-export-core.md) — deterministic site tree
- [x] [feature] [static-export-writer](roadmap/P3/static-export-writer.md) — Bug: /next-roadmap-item static-export-writer
- [ ] [feature] [static-export-kit](roadmap/P3/static-export-kit.md) — Bug: /next-roadmap-item static-export-kit
- [ ] [feature] [static-export](roadmap/P3/static-export.md) — write `dist/`
- [ ] [prep] [derivative-tuning](roadmap/P3/derivative-tuning.md) — decide final sizes
- [x] [prep] [hosting-decision](roadmap/P3/hosting-decision.md) — spike
- [ ] [feature] [publish-credentials](roadmap/P3/publish-credentials.md) — connect the editor to your hosting (Security Review)
- [ ] [feature] [in-app-publish](roadmap/P3/in-app-publish.md) — publish button (Security Review)
- [ ] [feature] [site-settings](roadmap/P3/site-settings.md) — personalize the showcase

## P4 — Print

**Review cut:** a print PDF from the `#/demo` Print dialog (1 per sheet with a bleed checkbox; 2-up saddle-stitch and 4-up duplex with `booklet-imposition`) and a cover with the right spine; exporting never freezes the editor.

- [x] [prep] [print-model-schema](roadmap/P4/print-model-schema.md) — print settings and cover in the document
- [x] [feature] [print-model-pbt-timeout](roadmap/P4/print-model-pbt-timeout.md) — Bug: print-model PBT times out in loaded pre-push runs
- [x] [prep] [print-profiles](roadmap/P4/print-profiles.md) — printer data
- [ ] [prep] [preflight-core](roadmap/P4/preflight-core.md) — pure preflight
- [ ] [prep] [pdf-painter](roadmap/P4/pdf-painter.md) — worker PDF painter (Security Review: dependency)
- [ ] [prep] [pdf-color-tagging](roadmap/P4/pdf-color-tagging.md) — keep photo colors
- [ ] [feature] [pdf-export](roadmap/P4/pdf-export.md) — print PDF
- [ ] [prep] [pdf-captions](roadmap/P4/pdf-captions.md) — text in the PDF
- [ ] [contingency] [pdf-streaming](roadmap/P4/pdf-streaming.md) — only if `pdf-export` peak memory is too high
- [ ] [feature] [booklet-imposition](roadmap/P4/booklet-imposition.md) — home printing
- [ ] [feature] [cover-editor](roadmap/P4/cover-editor.md) — cover in the editor

## P5 — Others make their own personal site

**Review cut:** someone else gets their own library and site. **Kit-first:** Designer drafts the P5 kit pages (onboarding / account, own library + site, hosting / connect) before items are sliced (call D6); `printer-presets` and `connect-own-hosting` have a partial kit (Settings → Print presets / Hosting rows). `onboarding-others` is held in `docs/backlog/` until then.

- [ ] [prep] [publisher-targets](roadmap/P5/publisher-targets.md) — generalize publishing
- [ ] [feature] [connect-own-hosting](roadmap/P5/connect-own-hosting.md) — bring your own hosting (Security Review)
- [ ] [feature] [printer-presets](roadmap/P5/printer-presets.md) — print for everyone
- [ ] [lite] [deps-dev-knip-relink](roadmap/P5/deps-dev-knip-relink.md) — Bug: /next-roadmap-item deps-dev-knip-relink
- [ ] [feature] [spread-thumb-grey-backing](roadmap/P5/spread-thumb-grey-backing.md) — Bug: /next-roadmap-item spread-thumb-grey-backing
- [ ] [feature] [page-count-mismatch](roadmap/P5/page-count-mismatch.md) — Bug: /next-roadmap-item page-count-mismatch
- [ ] [feature] [e2e-paint-probe](roadmap/P5/e2e-paint-probe.md) — Bug: /next-roadmap-item e2e-paint-probe
- [ ] [feature] [kit-gaps](roadmap/P5/kit-gaps.md) — Bug: /next-roadmap-item kit-gaps
- [ ] [feature] [text-blocks-close](roadmap/P5/text-blocks-close.md) — Bug: /next-roadmap-item text-blocks-close
- [ ] [feature] [site-lightbox-zoom-core](roadmap/P5/site-lightbox-zoom-core.md) — Bug: /next-roadmap-item site-lightbox-zoom-core

## Deferred (not scheduled)

Not scheduled, not items: [roadmap/DEFERRED.md](roadmap/DEFERRED.md). Former roadmap items waiting for an explicit re-add live in [docs/backlog/](backlog/README.md). To schedule either, the owner asks for an `add`.
