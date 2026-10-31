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

Finished items are deleted from the index (git history is the record); M3 and M4 were retired. Items whose kit page was removed in v0.10 with no replacement, and kit-first items whose UI is absent from `uikit/src/sandbox` (Designer call B1, 2026-10-30), are held in `docs/backlog/`; Owner re-adds them with `pnpm roadmap add` once their kit page lands. "In the kit" means present in `uikit/src/sandbox` and wired into the `#/demo` editor, even if reachable only through a flag or shortcut (RULES.md); such items are scheduled with sandbox `file:line` refs and marked `kit: sandbox, not shown in #/demo` (Designer kit-first audit, 2026-10-30). Counts: P1 2, P2 12, P3 13, P4 10, P5 3 open; held in `docs/backlog/`: 3 kit-first (`guides-precise`, `kit2-undo-history` history list, `onboarding-others`) and 5 with their kit page removed (incl. `preflight-fixes`).

## P1 — Align the editor to the kit (v0.10.0)

**Review cut:** product screens look like kit v0.10.0 `#/demo`; stubs allowed, no fake controls. Done when: product screens match `#/demo` baseline steps 01–20, 23–26 and 39–49 by Designer review (21–22 land with P2 `parent-spreads`, 27–31 with P4 `pdf-export`, 32–38 with P3).

- [x] [feature] [design-r3-spread-shadow](roadmap/P1/design-r3-spread-shadow.md) — Bug: design-r3-spread-shadow: soft constant-px spread shadow (M35) + 72/588 stack gap (M36)
- [ ] [feature] [fix-flaky-node-tests](roadmap/P1/fix-flaky-node-tests.md) — Bug: fix-flaky-node-tests: make 2 flaky node tests deterministic (root cause, no loosening)
- [ ] [lite] [e2e-photo-fixture-race](roadmap/P1/e2e-photo-fixture-race.md) — Fix: e2e photo fixtures are rewritten while other workers import them
- [x] [feature] [design-r3-canvas-fit](roadmap/P1/design-r3-canvas-fit.md) — Bug: design-r3-canvas-fit: canvas Fit on spread change + click on a selected frame
- [x] [feature] [design-r4-polish](roadmap/P1/design-r4-polish.md) — Bug: design-r4-polish: drag hint, canvas-centred tool group, 31 px menu rows, sort dot, floor page-number rule
- [ ] [feature] [design-r5-polish](roadmap/P1/design-r5-polish.md) — Bug: design-r5-polish: drag source keeps its photo, top-bar Library inset

## P2 — Missing features, iterative

**Review cut:** features removed or held in kit v0.10 come back one by one; items whose UI is in the kit sandbox carry sandbox refs (`rulers`, `guides`, `dpi-badge`, `text-blocks`, `live-captions`, `parent-guides`, `parent-overrides`, `page-numbers`); P1 `kit10-demo-expose-hidden` makes the hidden ones visible in `#/demo`. Only UI absent from the sandbox stays held in `docs/backlog/` until Designer adds the kit page. Owner and Designer decide the order.

- [ ] [feature] [arrange-lock](roadmap/P2/arrange-lock.md) — stacking and locking
- [ ] [feature] [multi-select](roadmap/P2/multi-select.md) — group operations
- [ ] [feature] [text-blocks](roadmap/P2/text-blocks.md) — captions
- [ ] [feature] [live-captions](roadmap/P2/live-captions.md) — captions from photo metadata
- [ ] [feature] [frame-styles](roadmap/P2/frame-styles.md) — consistent frames across the book
- [ ] [prep] [parent-spreads-schema](roadmap/P2/parent-spreads-schema.md) — parent spreads in the document
- [ ] [feature] [parent-spreads](roadmap/P2/parent-spreads.md) — parent spreads
- [ ] [feature] [layout-grids-parent-inherit](roadmap/P2/layout-grids-parent-inherit.md) — grids on parent spreads
- [ ] [feature] [parent-guides](roadmap/P2/parent-guides.md) — guides on parent spreads
- [ ] [feature] [parent-overrides](roadmap/P2/parent-overrides.md) — change one spread without touching the parent
- [ ] [feature] [page-numbers](roadmap/P2/page-numbers.md) — page numbers
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

## Deferred (not scheduled)

Not scheduled, not items: [roadmap/DEFERRED.md](roadmap/DEFERRED.md). Former roadmap items waiting for an explicit re-add live in [docs/backlog/](backlog/README.md). To schedule either, the owner asks for an `add`.
