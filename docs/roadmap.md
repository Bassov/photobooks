# Roadmap

Execution plan for the photobook editor. Architecture and decisions: `docs/future-architecture.md`.

This index and the item files under `docs/roadmap/` are the single source of truth for what gets built and in which order: issues, proposals and review notes are inputs until they land here. The UI kit **v0.9.3** (`uikit/`) is the UI/UX reference for roadmap items (screen / full / demo / feature routes), not a second plan.

Process: [roadmap/RULES.md](roadmap/RULES.md). One file per item: `roadmap/<milestone>/<slug>.md`. Retire a finished milestone with `pnpm roadmap archive <M>` (drops the index block and folder; git history is SoT). Change the index only with `pnpm roadmap` (`add` / `done` / `move` / `sync` / `archive`), never by hand.

## Order

1. **M1–M4.5 — the local editor, complete for personal use.** M2.1–M2.6 have shipped or moved to `docs/backlog/` (product screens run on UI kit **v0.9.3** chrome since M2.6). M3–M4.5 build the editor on that chrome. Hardening ideas sit in `docs/backlog/` until the owner re-adds them.
2. **M5, then M7 — books as a website (parked):** needs photo preprocessing + Cloudflare before work resumes. Kit site demos (`uikit#/screen/showcase-site`, publish) are **not now**.
3. **M6 — print** (after M7). Kit print demos (`uikit#/screen/print-prep`, `print-export`) are **not now**.
4. **M8 — let others create their own books, sites and prints.**

## M3 — Building a real book

**Review cut:** you can assemble a complete real book from your own photos without reaching for InDesign — orientation-aware templates and multi-photo drops make layout fast, the assets panel shows what is used, missing or modified — and a 1000-photo library feels instant.

- [x] [feature] [ui-create-dialog-chrome-v93](roadmap/M3/ui-create-dialog-chrome-v93.md) — Create dialog chrome: centered+dim, Cancel+Create visible, field borders #D7D7D7
- [ ] [prep] [editor-command-sequence-pbt](roadmap/M3/editor-command-sequence-pbt.md) — property tests over command sequences (issue #50 item 2)
- [ ] [feature] [document-history](roadmap/M3/document-history.md) — undo / redo
- [ ] [feature] [filmstrip-sort-filter](roadmap/M3/filmstrip-sort-filter.md) — working with the gallery
- [ ] [feature] [filmstrip-resize-drop](roadmap/M3/filmstrip-resize-drop.md) — filmstrip size and desktop drop
- [ ] [feature] [template-slot-aspects](roadmap/M3/template-slot-aspects.md) — orientation-aware templates
- [ ] [feature] [multi-drop-fill](roadmap/M3/multi-drop-fill.md) — faster layout
- [ ] [feature] [crop-in-frame](roadmap/M3/crop-in-frame.md) — non-destructive crop
- [ ] [prep] [ui-panels](roadmap/M3/ui-panels.md) — side panel frame
- [ ] [feature] [spread-list-panel](roadmap/M3/spread-list-panel.md) — spread list (Google Slides style)
- [ ] [feature] [spread-reorder-retemplate](roadmap/M3/spread-reorder-retemplate.md) — reorder and re-template spreads
- [ ] [feature] [assets-panel](roadmap/M3/assets-panel.md) — book assets at a glance
- [ ] [feature] [presentation-mode](roadmap/M3/presentation-mode.md) — preview the book

## M4 — Free layout: grids, guides, frames

**Review cut:** layouts beyond templates — page layout grids and guides like InDesign / Affinity / Figma with snapping, direct manipulation, precise numeric control and photo rotation, all at 60 fps.

- [ ] [prep] [frame-geometry-schema](roadmap/M4/frame-geometry-schema.md) — rotation and lock in the document
- [ ] [prep] [layout-grids-schema](roadmap/M4/layout-grids-schema.md) — page layout grids in the document
- [ ] [prep] [frame-transform-ops](roadmap/M4/frame-transform-ops.md) — pure free-layout math
- [ ] [prep] [snapping-engine](roadmap/M4/snapping-engine.md) — pure snapping
- [ ] [prep] [ui-primitives-forms](roadmap/M4/ui-primitives-forms.md) — form primitives in `src/ui/`
- [ ] [feature] [rulers](roadmap/M4/rulers.md) — mm rulers
- [ ] [feature] [guides](roadmap/M4/guides.md) — guides
- [ ] [feature] [guides-precise](roadmap/M4/guides-precise.md) — exact guides
- [ ] [feature] [frame-selection-handles](roadmap/M4/frame-selection-handles.md) — direct manipulation
- [ ] [feature] [layout-grids-settings](roadmap/M4/layout-grids-settings.md) — margins, columns, rows, gutters
- [ ] [feature] [layout-grids-render-snap](roadmap/M4/layout-grids-render-snap.md) — see the grid, snap to it
- [ ] [feature] [free-frames](roadmap/M4/free-frames.md) — free layout
- [ ] [feature] [photo-rotate](roadmap/M4/photo-rotate.md) — rotate photos in frames
- [ ] [feature] [inspector](roadmap/M4/inspector.md) — numeric properties
- [ ] [feature] [arrange-lock](roadmap/M4/arrange-lock.md) — stacking and locking
- [ ] [feature] [multi-select](roadmap/M4/multi-select.md) — group operations

## M4.5 — Text, styles and reuse (local editor complete)

**Review cut:** the local editor is complete for personal use — captions from photo metadata, frame styles, parent spreads that carry layout grids, guides and shared elements across the book (overridable per spread), your own templates, all at 60 fps.

- [ ] [prep] [book-fonts](roadmap/M4.5/book-fonts.md) — fonts for book content
- [ ] [prep] [text-frame-model](roadmap/M4.5/text-frame-model.md) — text in the document
- [ ] [feature] [text-blocks](roadmap/M4.5/text-blocks.md) — captions
- [ ] [feature] [live-captions](roadmap/M4.5/live-captions.md) — captions from photo metadata
- [ ] [prep] [book-styles-schema](roadmap/M4.5/book-styles-schema.md) — book-level styles in the document
- [ ] [feature] [frame-styles](roadmap/M4.5/frame-styles.md) — consistent frames across the book
- [ ] [feature] [user-templates](roadmap/M4.5/user-templates.md) — your own layouts
- [ ] [prep] [parent-spreads-schema](roadmap/M4.5/parent-spreads-schema.md) — parent spreads in the document
- [ ] [feature] [parent-spreads](roadmap/M4.5/parent-spreads.md) — parent spreads
- [ ] [feature] [layout-grids-parent-inherit](roadmap/M4.5/layout-grids-parent-inherit.md) — grids on parent spreads
- [ ] [feature] [parent-guides](roadmap/M4.5/parent-guides.md) — guides on parent spreads
- [ ] [feature] [parent-overrides](roadmap/M4.5/parent-overrides.md) — change one spread without touching the parent
- [ ] [feature] [page-numbers](roadmap/M4.5/page-numbers.md) — page numbers

## M5 — Showcase site with books (local)

**Review cut:** the showcase site with your books, previewed from the editor and exported to a folder, looks right and scrolls / swipes at 60 fps on a phone and on a 27″ 4K screen.

**Not now:** parked until photo preprocessing + Cloudflare; kit site demos (`uikit#/screen/showcase-site`) are reference only until this milestone resumes.

- [ ] [prep] [image-derivatives](roadmap/M5/image-derivatives.md) — web image pipeline
- [ ] [prep] [avif-encoder](roadmap/M5/avif-encoder.md) — AVIF derivatives (Security Review: dependency)
- [ ] [prep] [publish-revisions](roadmap/M5/publish-revisions.md) — draft vs published
- [ ] [feature] [site-viewer](roadmap/M5/site-viewer.md) — viewer entry
- [ ] [feature] [site-preview-mode](roadmap/M5/site-preview-mode.md) — preview the site from the editor
- [ ] [feature] [site-lightbox](roadmap/M5/site-lightbox.md) — fullscreen and swipe
- [ ] [prep] [static-export-core](roadmap/M5/static-export-core.md) — deterministic site tree
- [ ] [feature] [static-export](roadmap/M5/static-export.md) — write `dist/`
- [ ] [feature] [derivative-tuning](roadmap/M5/derivative-tuning.md) — decide final sizes

## M7 — Deploy as my site

**Review cut:** your own live site with your books, updated incrementally from the editor.

**Not now:** parked with M5 (photo preprocess + Cloudflare); kit publish demos are reference only until this milestone resumes.

- [ ] [prep] [hosting-decision](roadmap/M7/hosting-decision.md) — spike
- [ ] [feature] [manual-deploy](roadmap/M7/manual-deploy.md) — documented deploy path
- [ ] [feature] [publish-credentials](roadmap/M7/publish-credentials.md) — connect the editor to your hosting (Security Review)
- [ ] [feature] [in-app-publish](roadmap/M7/in-app-publish.md) — publish button (Security Review)

## M6 — Print

**Review cut:** a PDF (pages or spreads, as the print shop wants) or JPEG spreads you can send to a print shop, a cover with the right spine, and a booklet you can print at home; low-resolution photos are flagged on their frames while you lay out; exporting never freezes the editor.

**Not now for kit demos:** print screens (`uikit#/screen/print-prep`, `print-export`) wait until after the editor-ready M2.6 cut and M5/M7; do not start print UI ports from those demos yet.

- [ ] [prep] [print-model-schema](roadmap/M6/print-model-schema.md) — print settings and cover in the document
- [ ] [prep] [print-profiles](roadmap/M6/print-profiles.md) — printer data and preflight
- [ ] [feature] [dpi-badge](roadmap/M6/dpi-badge.md) — resolution while you lay out
- [ ] [feature] [print-overlays](roadmap/M6/print-overlays.md) — see print constraints
- [ ] [feature] [preflight-panel](roadmap/M6/preflight-panel.md) — print warnings
- [ ] [feature] [preflight-fixes](roadmap/M6/preflight-fixes.md) — fix from the panel
- [ ] [prep] [pdf-painter](roadmap/M6/pdf-painter.md) — worker PDF painter (Security Review: dependency)
- [ ] [prep] [pdf-color-tagging](roadmap/M6/pdf-color-tagging.md) — keep photo colors
- [ ] [feature] [pdf-export](roadmap/M6/pdf-export.md) — print PDF
- [ ] [contingency] [pdf-streaming](roadmap/M6/pdf-streaming.md) — only if `pdf-export` peak memory is too high
- [ ] [feature] [jpeg-spreads-export](roadmap/M6/jpeg-spreads-export.md) — JPEG spreads
- [ ] [feature] [pdf-captions](roadmap/M6/pdf-captions.md) — text in the PDF
- [ ] [feature] [print-package-report](roadmap/M6/print-package-report.md) — what the print shop needs
- [ ] [feature] [booklet-imposition](roadmap/M6/booklet-imposition.md) — home printing
- [ ] [feature] [cover-editor](roadmap/M6/cover-editor.md) — cover in the editor
- [ ] [feature] [cover-pdf](roadmap/M6/cover-pdf.md) — cover PDF

## M8 — For others

**Review cut:** someone else opens the editor, makes a book, prints it and publishes their own site to their own account without touching code or config files.

**Re-plan:** at the M6 review cut; items are not yet sliced to the change budget.

- [ ] [prep] [publisher-targets](roadmap/M8/publisher-targets.md) — generalize publishing
- [ ] [feature] [onboarding](roadmap/M8/onboarding.md) — first run
- [ ] [feature] [connect-own-hosting](roadmap/M8/connect-own-hosting.md) — bring your own hosting (Security Review)
- [ ] [feature] [site-settings](roadmap/M8/site-settings.md) — personalize the showcase
- [ ] [feature] [printer-presets](roadmap/M8/printer-presets.md) — print for everyone

## Deferred (not scheduled)

Not scheduled, not items: [roadmap/DEFERRED.md](roadmap/DEFERRED.md). Former roadmap items waiting for an explicit re-add live in [docs/backlog/](backlog/README.md). To schedule either, the owner asks for an `add`.
