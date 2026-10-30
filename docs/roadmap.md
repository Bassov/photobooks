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

M3 and M4 below keep finished items until the owner archives them (M4 is fully done; M3 is now fully done too: its open rig item `rig-pr-body-gate-removal` moved to the top of P1, Owner-confirm); all other open items moved into P1–P5. Items whose kit page was removed in v0.10 with no replacement, and kit-first items whose UI is absent from `uikit/src/sandbox` (Designer call B1, 2026-10-30), are held in `docs/backlog/`; Owner re-adds them with `pnpm roadmap add` once their kit page lands. "In the kit" means present in `uikit/src/sandbox` and wired into the `#/demo` editor, even if reachable only through a flag or shortcut (RULES.md); such items are scheduled with sandbox `file:line` refs and marked `kit: sandbox, not shown in #/demo` (Designer kit-first audit, 2026-10-30). Counts: P1 21, P2 22, P3 13, P4 10, P5 3 open; held in `docs/backlog/`: 3 kit-first (`guides-precise`, `kit2-undo-history` history list, `onboarding-others`) and 5 with their kit page removed (incl. `preflight-fixes`).

## P1 — Align the editor to the kit (v0.10.0)

**Review cut:** product screens look like kit v0.10.0 `#/demo`; stubs allowed, no fake controls. Done when: product screens match `#/demo` baseline steps 01–20, 23–26 and 39–49 by Designer review (21–22 land with P2 `parent-spreads`, 27–31 with P4 `pdf-export`, 32–38 with P3).

- [x] [prep] [rig-pr-body-gate-removal](roadmap/P1/rig-pr-body-gate-removal.md) — ts-agent-rig: remove pr-body gate, optional finish --body-file, pin bump
- [x] [prep] [ui-primitives-forms](roadmap/P1/ui-primitives-forms.md) — form primitives in `src/ui/`
- [x] [prep] [cover-endpaper-schema](roadmap/P1/cover-endpaper-schema.md) — cover and endpapers in the document
- [x] [feature] [kit10-library-folder](roadmap/P1/kit10-library-folder.md) — Welcome and library folder: kit v0.10 look
- [x] [feature] [kit10-library-books](roadmap/P1/kit10-library-books.md) — Your books grid: kit v0.10 look
- [x] [feature] [kit10-create-book](roadmap/P1/kit10-create-book.md) — Create book dialog: kit v0.10 look (title, page size, custom size)
- [x] [feature] [kit10-editor-chrome](roadmap/P1/kit10-editor-chrome.md) — Editor top bar and panels: kit v0.10 look
- [x] [feature] [kit10-filmstrip](roadmap/P1/kit10-filmstrip.md) — Photos dock and filmstrip: kit v0.10 look (Photos only)
- [x] [feature] [kit10-spread-list](roadmap/P1/kit10-spread-list.md) — Spread list panel: kit v0.10 look (cover, endpapers, spreads, Pages / Masters)
- [x] [feature] [kit10-canvas](roadmap/P1/kit10-canvas.md) — Canvas and pasteboard: kit v0.10 look
- [x] [feature] [kit10-place-replace](roadmap/P1/kit10-place-replace.md) — Drag place and replace: kit v0.10 look
- [x] [feature] [kit10-frame-selection](roadmap/P1/kit10-frame-selection.md) — Frame selection and move: kit v0.10 look
- [x] [feature] [kit10-crop](roadmap/P1/kit10-crop.md) — Crop in frame: kit v0.10 look
- [x] [feature] [kit10-inspector-frame-spread](roadmap/P1/kit10-inspector-frame-spread.md) — Inspector frame and spread: kit v0.10 look
- [x] [feature] [kit10-inspector-book-endpaper](roadmap/P1/kit10-inspector-book-endpaper.md) — Inspector book settings and endpaper: kit v0.10 look
- [x] [feature] [kit10-grid-snap](roadmap/P1/kit10-grid-snap.md) — Layout grid and snap: kit v0.10 look
- [x] [feature] [kit10-masters](roadmap/P1/kit10-masters.md) — Masters mode: kit v0.10 look
- [x] [feature] [kit10-cover](roadmap/P1/kit10-cover.md) — Cover on canvas and in the inspector: kit v0.10 look
- [x] [feature] [kit10-settings](roadmap/P1/kit10-settings.md) — Settings screen: kit v0.10 look
- [ ] [feature] [kit10-stage5-pixel-fixes](roadmap/P1/kit10-stage5-pixel-fixes.md) — Kit stage-5 pixel fixes in product (Low-res chip gray, contrast, >=20 pages)
- [ ] [feature] [design-inspector](roadmap/P1/design-inspector.md) — Bug: design-inspector: prod parity design fixes
- [x] [feature] [kit10-demo-expose-hidden](roadmap/P1/kit10-demo-expose-hidden.md) — Kit #/demo: expose hidden sandbox features (views, spread menu, parent edit, missing photo, relink)

## P2 — Missing features, iterative

**Review cut:** features removed or held in kit v0.10 come back one by one; items whose UI is in the kit sandbox carry sandbox refs (`rulers`, `guides`, `dpi-badge`, `text-blocks`, `live-captions`, `parent-guides`, `parent-overrides`, `page-numbers`); P1 `kit10-demo-expose-hidden` makes the hidden ones visible in `#/demo`. Only UI absent from the sandbox stays held in `docs/backlog/` until Designer adds the kit page. Owner and Designer decide the order.

- [ ] [feature] [rulers](roadmap/P2/rulers.md) — mm rulers
- [ ] [feature] [guides](roadmap/P2/guides.md) — guides
- [x] [feature] [dpi-badge](roadmap/P2/dpi-badge.md) — resolution while you lay out
- [ ] [feature] [photo-rotate](roadmap/P2/photo-rotate.md) — rotate photos in frames
- [ ] [feature] [inspector](roadmap/P2/inspector.md) — numeric properties
- [ ] [feature] [arrange-lock](roadmap/P2/arrange-lock.md) — stacking and locking
- [ ] [feature] [multi-select](roadmap/P2/multi-select.md) — group operations
- [ ] [prep] [book-fonts](roadmap/P2/book-fonts.md) — fonts for book content
- [ ] [prep] [text-frame-model](roadmap/P2/text-frame-model.md) — text in the document
- [ ] [feature] [text-blocks](roadmap/P2/text-blocks.md) — captions
- [ ] [feature] [live-captions](roadmap/P2/live-captions.md) — captions from photo metadata
- [ ] [prep] [book-styles-schema](roadmap/P2/book-styles-schema.md) — book-level styles in the document
- [ ] [feature] [frame-styles](roadmap/P2/frame-styles.md) — consistent frames across the book
- [ ] [prep] [layout-grids-schema](roadmap/P2/layout-grids-schema.md) — page layout grids in the document
- [ ] [prep] [parent-spreads-schema](roadmap/P2/parent-spreads-schema.md) — parent spreads in the document
- [ ] [feature] [parent-spreads](roadmap/P2/parent-spreads.md) — parent spreads
- [ ] [feature] [layout-grids-parent-inherit](roadmap/P2/layout-grids-parent-inherit.md) — grids on parent spreads
- [ ] [feature] [parent-guides](roadmap/P2/parent-guides.md) — guides on parent spreads
- [ ] [feature] [parent-overrides](roadmap/P2/parent-overrides.md) — change one spread without touching the parent
- [ ] [feature] [page-numbers](roadmap/P2/page-numbers.md) — page numbers
- [ ] [prep] [library-json-schema](roadmap/P2/library-json-schema.md) — `library.json` versioning
- [ ] [feature] [user-templates](roadmap/P2/user-templates.md) — your own layouts

## P3 — Personal site

**Review cut:** your own live site with your books: viewer, lightbox, preview, publish, site and hosting settings, at 60 fps on a phone and a 27″ 4K screen.

- [ ] [prep] [image-derivatives](roadmap/P3/image-derivatives.md) — web image pipeline
- [ ] [prep] [avif-encoder](roadmap/P3/avif-encoder.md) — AVIF derivatives (Security Review: dependency)
- [ ] [prep] [publish-revisions](roadmap/P3/publish-revisions.md) — draft vs published
- [ ] [feature] [site-viewer](roadmap/P3/site-viewer.md) — viewer entry
- [ ] [feature] [site-preview-mode](roadmap/P3/site-preview-mode.md) — preview the site from the editor
- [ ] [feature] [site-lightbox](roadmap/P3/site-lightbox.md) — fullscreen and swipe
- [ ] [prep] [static-export-core](roadmap/P3/static-export-core.md) — deterministic site tree
- [ ] [feature] [static-export](roadmap/P3/static-export.md) — write `dist/`
- [ ] [prep] [derivative-tuning](roadmap/P3/derivative-tuning.md) — decide final sizes
- [ ] [prep] [hosting-decision](roadmap/P3/hosting-decision.md) — spike
- [ ] [feature] [publish-credentials](roadmap/P3/publish-credentials.md) — connect the editor to your hosting (Security Review)
- [ ] [feature] [in-app-publish](roadmap/P3/in-app-publish.md) — publish button (Security Review)
- [ ] [feature] [site-settings](roadmap/P3/site-settings.md) — personalize the showcase

## P4 — Print

**Review cut:** a print PDF from the `#/demo` Print dialog (1 per sheet with a bleed checkbox; 2-up saddle-stitch and 4-up duplex with `booklet-imposition`) and a cover with the right spine; exporting never freezes the editor.

- [ ] [prep] [print-model-schema](roadmap/P4/print-model-schema.md) — print settings and cover in the document
- [ ] [prep] [print-profiles](roadmap/P4/print-profiles.md) — printer data
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

## M3 — Building a real book

**Review cut:** you can assemble a complete real book from your own photos without reaching for InDesign — orientation-aware templates and multi-photo drops make layout fast, the assets panel shows what is used, missing or modified — and a 1000-photo library feels instant.

- [x] [prep] [pr-body-free-form](roadmap/M3/pr-body-free-form.md) — Drop PR body content gate (rig + CI)
- [x] [prep] [pr-body-free-form-tail](roadmap/M3/pr-body-free-form-tail.md) — Finish PR body free-form: docs and live-PR waiver in checks.yml
- [x] [prep] [stryker-diff-scope](roadmap/M3/stryker-diff-scope.md) — Measure stryker-diff cost and survivors; Owner picks keep / exclude / C-session
- [x] [prep] [stryker-c-session](roadmap/M3/stryker-c-session.md) — Stryker survivors move to a dedicated C-session (Owner option (c), #267)
- [x] [prep] [fix-place-fit-aspect](roadmap/M3/fix-place-fit-aspect.md) — Fix placed photo aspect: no stretched portraits, cover crop in thumbs and canvas
- [x] [lite] [fix-landscape-letterbox](roadmap/M3/fix-landscape-letterbox.md) — Fix landscape/panorama letterboxing in portrait frames: place and Fill use cover crop
- [x] [feature] [ui-chrome-musts-recheck](roadmap/M3/ui-chrome-musts-recheck.md) — Chrome Musts: book covers, settings nav tone-only, quiet editor header
- [x] [feature] [ui-create-dialog-chrome-v93](roadmap/M3/ui-create-dialog-chrome-v93.md) — Create dialog chrome: centered+dim, Cancel+Create visible, field borders #D7D7D7
- [x] [feature] [ui-settings-chrome-v93](roadmap/M3/ui-settings-chrome-v93.md) — Settings chrome: tone-only nav, gray folder access, Preview cache
- [x] [feature] [ui-welcome-type-v93](roadmap/M3/ui-welcome-type-v93.md) — Welcome Lora italic + weight 400 vs kit
- [x] [feature] [ui-editor-look-v93](roadmap/M3/ui-editor-look-v93.md) — Editor look: kit canvas surround, selection-only outline, quiet header
- [x] [feature] [ui-library-chrome-v93](roadmap/M3/ui-library-chrome-v93.md) — Kit v0.9.3 library chrome + book covers
- [x] [prep] [editor-command-sequence-pbt](roadmap/M3/editor-command-sequence-pbt.md) — property tests over command sequences (issue #50 item 2)
- [x] [feature] [document-history](roadmap/M3/document-history.md) — undo / redo
- [x] [feature] [filmstrip-sort-filter](roadmap/M3/filmstrip-sort-filter.md) — working with the gallery
- [x] [feature] [filmstrip-resize-drop](roadmap/M3/filmstrip-resize-drop.md) — filmstrip size and desktop drop
- [x] [feature] [template-slot-aspects](roadmap/M3/template-slot-aspects.md) — orientation-aware templates
- [x] [feature] [multi-drop-fill](roadmap/M3/multi-drop-fill.md) — faster layout
- [x] [feature] [crop-in-frame](roadmap/M3/crop-in-frame.md) — non-destructive crop
- [x] [prep] [ui-panels](roadmap/M3/ui-panels.md) — side panel frame
- [x] [feature] [spread-list-panel](roadmap/M3/spread-list-panel.md) — spread list (Google Slides style)
- [x] [feature] [spread-reorder-retemplate](roadmap/M3/spread-reorder-retemplate.md) — reorder and re-template spreads
- [x] [feature] [behavior-invariants](roadmap/M3/behavior-invariants.md) — PBT invariants for placement/fit
- [x] [feature] [assets-panel](roadmap/M3/assets-panel.md) — book assets at a glance
- [x] [feature] [look-parity-inspector](roadmap/M3/look-parity-inspector.md) — look parity: inspector shell + quiet header
- [x] [feature] [look-parity-canvas-sel](roadmap/M3/look-parity-canvas-sel.md) — look parity: canvas selection-only chrome
- [x] [feature] [look-parity-fit-crop](roadmap/M3/look-parity-fit-crop.md) — look parity: Fit & crop in the inspector
- [x] [feature] [look-parity-filmstrip](roadmap/M3/look-parity-filmstrip.md) — look parity: filmstrip kit chrome
- [x] [feature] [look-parity-tool-rail](roadmap/M3/look-parity-tool-rail.md) — look parity: tool rail in the header
- [x] [feature] [look-parity-masters](roadmap/M3/look-parity-masters.md) — look parity: left list kit chrome
- [x] [feature] [presentation-mode](roadmap/M3/presentation-mode.md) — preview the book
- [x] [prep] [denials-zero](roadmap/M3/denials-zero.md) — Cut headless permission denials (run card + scratch dir)
- [x] [feature] [recents-idb-dedup](roadmap/M3/recents-idb-dedup.md) — session IDB typed faults, recents isSameEntry dedup, eviction cleanup

## M4 — Free layout: grids, guides, frames

**Review cut:** layouts beyond templates — page layout grids and guides like InDesign / Affinity / Figma with snapping, direct manipulation, precise numeric control and photo rotation, all at 60 fps.

- [x] [prep] [frame-geometry-schema](roadmap/M4/frame-geometry-schema.md) — rotation and lock in the document
- [x] [prep] [frame-transform-ops](roadmap/M4/frame-transform-ops.md) — pure free-layout math
- [x] [prep] [snapping-engine](roadmap/M4/snapping-engine.md) — pure snapping
- [x] [feature] [frame-selection-handles](roadmap/M4/frame-selection-handles.md) — direct manipulation
- [x] [feature] [layout-grids-settings](roadmap/M4/layout-grids-settings.md) — margins, columns, rows, gutters
- [x] [feature] [layout-grids-render-snap](roadmap/M4/layout-grids-render-snap.md) — see the grid
- [x] [feature] [layout-grids-snap-wire](roadmap/M4/layout-grids-snap-wire.md) — wire grid snap into frame move/resize
- [x] [feature] [free-frames](roadmap/M4/free-frames.md) — free layout
- [x] [feature] [look-parity-inspector-tabs](roadmap/M4/look-parity-inspector-tabs.md) — look parity: inspector Frame / Spread / Book tabs
- [x] [feature] [inspector-frame-sections](roadmap/M4/inspector-frame-sections.md) — look parity: inspector Frame tab sections (Geometry / Arrange / Align / Delete)
- [x] [feature] [inspector-spread-book](roadmap/M4/inspector-spread-book.md) — look parity: inspector Spread and Book tab sections (Layout / Layout grid; Book settings + grid)
- [x] [lite] [look-parity-scrollbars](roadmap/M4/look-parity-scrollbars.md) — look parity: thin custom scrollbars (kit v5)
- [x] [feature] [look-parity-rulers](roadmap/M4/look-parity-rulers.md) — look parity: mm rulers (kit look, no guides)
- [x] [feature] [look-parity-page-labels](roadmap/M4/look-parity-page-labels.md) — look parity: canvas page labels and drop-target visuals
- [x] [feature] [canvas-frame-chrome](roadmap/M4/canvas-frame-chrome.md) — look parity: canvas frame chrome (size tag, hover, empty/missing, lock, chips, rotate handle)
- [x] [feature] [topbar-kit-parity](roadmap/M4/topbar-kit-parity.md) — look parity: editor top bar and zoom menu as UI kit
- [x] [feature] [look-parity-dock-filmstrip](roadmap/M4/look-parity-dock-filmstrip.md) — look parity: dock header, folder drop overlay, filmstrip tiles and empty text

## Deferred (not scheduled)

Not scheduled, not items: [roadmap/DEFERRED.md](roadmap/DEFERRED.md). Former roadmap items waiting for an explicit re-add live in [docs/backlog/](backlog/README.md). To schedule either, the owner asks for an `add`.
