# Roadmap

Execution plan for the photobook editor. Architecture and decisions: `docs/future-architecture.md`.

This index and the item files under `docs/roadmap/` are the single source of truth for what gets built and in which order: issues, proposals and review notes are inputs until they land here. The UI kit (`uikit/`, from `uikit-import`) is the UI/UX reference for roadmap items, not a second plan.

Process: [roadmap/RULES.md](roadmap/RULES.md). One file per item: `roadmap/<milestone>/<slug>.md`; finished milestones: `roadmap/archive/`. Change the index only with `pnpm roadmap` (`add` / `done` / `move`), never by hand.

## Order

1. **M1–M4.5 — the local editor, complete for personal use.** M2.1 finishes the core quality gates and agent-process hardening (zero-retry e2e, mechanical coverage/mutation/exclusion/size/PR checks, cheaper agent runs, lessons dissolved, mutation re-includes for session/editor files); then M2.2 completes the library under those gates, and M2.5 fixes the visual language before more UI is built. Other hardening ideas sit in `docs/backlog/` until the owner re-adds them.
2. **M5, then M7 — books as a website:** the showcase site built and previewed locally, then deployed as my own site.
3. **M6 — print** (after M7).
4. **M8 — let others create their own books, sites and prints.**

## M2.1 — Quality gates & dev process

**Review cut:** reviews stop bouncing on mechanical issues. PR e2e runs with zero retries and an empty `@flaky` list. CI and `pnpm agent finish` refuse, with no label or agent override: gate values getting weaker, test-level weakening (skip / fixme / only / retries / deleted tests), any `Stryker disable` except the budgeted next-line form, new exclusions of production code, patch coverage under 85% (unit + e2e merged), a diff mutation score under 85 or any NoCoverage mutant, a changed-but-excluded file, PR bodies with stale metrics or missing verdicts, and an item whose plan or first push exceeds 1500 changed lines (review fixes stay in the same PR and only warn). `docs/lessons.md` is replaced by checks. Agent test runs stay cheap and fast (targeted quiet runs once; flake proof from CI burn-in). The stateful session and editor files are back in mutation scope behind unit-level fakes. After M2.1, product work resumes (M2.2, M2.5); the rest of the hardening ideas live in `docs/backlog/`.

Notes: [INTRO.md](roadmap/M2.1/INTRO.md)

- [x] [prep] [agent-rules](roadmap/M2.1/agent-rules.md) — agents never weaken gates, grow the roadmap instead of the PR, and resolve reviewer findings themselves (issue #72 E)
- [x] [prep] [agent-pipeline-token-budget](roadmap/M2.1/agent-pipeline-token-budget.md) — Cut /next-roadmap-item token waste (issue #77)
- [x] [prep] [agent-pipeline-fewer-calls](roadmap/M2.1/agent-pipeline-fewer-calls.md) — Fewer /next-roadmap-item tool calls (issue #79)
- [x] [prep] [add-spread-reveal-flake](roadmap/M2.1/add-spread-reveal-flake.md) — Strict fit-zoom add-spread containment: app scroll or deterministic wait
- [x] [prep] [e2e-burn-in](roadmap/M2.1/e2e-burn-in.md) — new and changed e2e specs are burned in on every PR
- [x] [prep] [narrow-add-spread-horizontal-contain](roadmap/M2.1/narrow-add-spread-horizontal-contain.md) — Add-spread reveal must contain horizontally (narrow and desktop)
- [x] [contingency] [burn-in-targets-cli-spawn-assert](roadmap/M2.1/burn-in-targets-cli-spawn-assert.md) — Burn-in targets spawn test must not assume burn-in-smoke in every PR diff
- [x] [prep] [e2e-local-flakes](roadmap/M2.1/e2e-local-flakes.md) — Stabilize functional e2e flakes (open-save, filmstrip gaps, template-unplace, autosave, drag-swap)
- [x] [prep] [e2e-frame-budget-flakes](roadmap/M2.1/e2e-frame-budget-flakes.md) — Stabilize frame-budget (LoAF) e2e flakes without looser budgets
- [x] [prep] [roadmap-parallel-agents](roadmap/M2.1/roadmap-parallel-agents.md) — roadmap CLI and agent pipeline support several agents in parallel git worktrees
- [ ] [prep] [continuous-zoom-settle-mount-pace](roadmap/M2.1/continuous-zoom-settle-mount-pace.md) — Pace pasteboard remounts on zoom-out settle to keep continuous-zoom LoAF green
- [ ] [prep] [strict-e2e](roadmap/M2.1/strict-e2e.md) — no hidden flakes: zero retries on PRs (#50 item 5)
- [x] [prep] [agent-test-run-budget](roadmap/M2.1/agent-test-run-budget.md) — agent test runs stay cheap and fast; flake proof comes from CI burn-in (owner 2026-10-18)
- [ ] [prep] [agent-pipeline-leftovers](roadmap/M2.1/agent-pipeline-leftovers.md) — Remaining token and call waste in the agent pipeline (issues #77, #79)
- [ ] [prep] [codecov-patch-gate](roadmap/M2.1/codecov-patch-gate.md) — blocking patch and no-drop project coverage (issue #72 A)
- [ ] [prep] [e2e-coverage-flag](roadmap/M2.1/e2e-coverage-flag.md) — e2e counts toward coverage and codecov/patch (issue #72 A, #29)
- [ ] [prep] [gate-values-file](roadmap/M2.1/gate-values-file.md) — one data file for gate thresholds
- [ ] [prep] [gate-ratchet](roadmap/M2.1/gate-ratchet.md) — gate values can only get stricter (issue #72 K, replaced by a ratchet)
- [ ] [prep] [gate-weakening-guard](roadmap/M2.1/gate-weakening-guard.md) — test-level weakening fails pr-policy (PR #76 pattern)
- [ ] [prep] [stryker-disable-budget](roadmap/M2.1/stryker-disable-budget.md) — only next-line Stryker disables, capped and budgeted (PR #81 pattern)
- [ ] [prep] [stryker-diff-gate](roadmap/M2.1/stryker-diff-gate.md) — honest mutation on the diff: break 85, zero NoCoverage (issue #72 B, J)
- [ ] [prep] [scripts-in-scope](roadmap/M2.1/scripts-in-scope.md) — gate and agent scripts are in coverage and mutation by default (PR #81 pattern)
- [ ] [prep] [exclusions-registry](roadmap/M2.1/exclusions-registry.md) — only non-production code can be excluded (issue #72 J, A)
- [ ] [prep] [diff-size-check](roadmap/M2.1/diff-size-check.md) — size limit on an item's initial scope; review fixes warn only (issue #72 H)
- [ ] [prep] [pr-body-check](roadmap/M2.1/pr-body-check.md) — machine-checked PR body: verdicts, dispositions, scenarios (issue #72 G)
- [ ] [prep] [pr-metrics-autogen](roadmap/M2.1/pr-metrics-autogen.md) — PR metrics come from CI, never typed by hand (PR #81, #82 stale numbers)
- [ ] [prep] [no-untested-branches](roadmap/M2.1/no-untested-branches.md) — unreachable code is deleted, not defended (dead/defensive code finding)
- [ ] [prep] [agent-self-check](roadmap/M2.1/agent-self-check.md) — agents self-review against the repo checklist before push
- [ ] [prep] [lessons-dissolve](roadmap/M2.1/lessons-dissolve.md) — Dissolve docs/lessons.md: repeat findings become checks or specs (issue #78)
- [ ] [prep] [necessary-minimum-rules](roadmap/M2.1/necessary-minimum-rules.md) — Necessary-minimum rules for artifacts and code, tests exempt (issue #78)
- [ ] [prep] [fsa-permission-fakes](roadmap/M2.1/fsa-permission-fakes.md) — unit-level File System Access fakes (issue #72 L)
- [ ] [prep] [mutation-reinclude-small](roadmap/M2.1/mutation-reinclude-small.md) — mutate the small files that already have tests (issue #72 B)
- [ ] [prep] [mutation-reinclude-camera](roadmap/M2.1/mutation-reinclude-camera.md) — mutate `usePasteboardCamera.ts` again (issue #72 B)
- [ ] [prep] [session-idb-locks-mutation](roadmap/M2.1/session-idb-locks-mutation.md) — IndexedDB and Web Locks fakes; mutate the adapters (issue #72 L, B)
- [ ] [prep] [editor-shell-mutation](roadmap/M2.1/editor-shell-mutation.md) — mutate `EditorShell.tsx` (issue #72 B)
- [ ] [prep] [home-app-mutation](roadmap/M2.1/home-app-mutation.md) — mutate HomeScreen.tsx and App.tsx (issue #72 B)
- [ ] [prep] [project-session-deps](roadmap/M2.1/project-session-deps.md) — inject the session's platform dependencies (issue #72 L)
- [ ] [prep] [autosave-controller](roadmap/M2.1/autosave-controller.md) — extract autosave from `projectSession.ts`
- [ ] [prep] [book-lock-controller](roadmap/M2.1/book-lock-controller.md) — extract locks and re-grant from `projectSession.ts`
- [ ] [prep] [library-activation](roadmap/M2.1/library-activation.md) — extract library open / new / switch from `projectSession.ts`
- [ ] [prep] [project-session-mutation](roadmap/M2.1/project-session-mutation.md) — mutate what is left of `projectSession.ts` (issue #72 B)
- [ ] [prep] [agent-pipeline-run-audit](roadmap/M2.1/agent-pipeline-run-audit.md) — Check one /next-roadmap-item run against the #77 and #79 targets

## M2.2 — Library & metadata

**Review cut:** under the M2.1 gates — the home screen handles every permission, picker and storage failure with a readable message, books have titles you set and rename, and photo metadata (capture time, orientation, color space) is in the document, read off the main thread.

- [ ] [feature] [recents-home-quality](roadmap/M2.2/recents-home-quality.md) — home polish after correctness (what M2.1 does not cover)
- [ ] [prep] [asset-metadata-schema](roadmap/M2.2/asset-metadata-schema.md) — photo metadata in the document
- [ ] [feature] [book-titles](roadmap/M2.2/book-titles.md) — create-with-title and rename
- [ ] [prep] [asset-metadata-extract](roadmap/M2.2/asset-metadata-extract.md) — fill metadata off the main thread

## M2.5 — Design foundation

**Review cut:** the UI kit is in the repo as the UI/UX reference, moved photo folders relink in one step, and the editor looks like one product — every surface uses tokens and shared primitives in light and dark themes, `docs/design.md` is the source of truth agents follow (enforced by `ui-review` and the design reviewer), screenshot baselines catch visual drift, and every existing 60 fps gate still passes.

- [ ] [prep] [uikit-import](roadmap/M2.5/uikit-import.md) — UI kit in the repo as the UI/UX reference (~950 lines + lockfile; step 1 of 10, rest via the growth rule below)
- [ ] [prep] [uikit-import-primitives-a](roadmap/M2.5/uikit-import-primitives-a.md) — button, checkbox, dialog, disclosure, field, grid-list, list-box, menu (~960 lines)
- [ ] [prep] [uikit-import-primitives-b](roadmap/M2.5/uikit-import-primitives-b.md) — numberfield, popover, progress, searchfield, select, separator, slider, switch, tabs (~850 lines)
- [ ] [prep] [uikit-import-primitives-c](roadmap/M2.5/uikit-import-primitives-c.md) — textfield, toast, toggle, toolbar, tooltip, Untitled UI badge / featured icon, app-density wrappers (~670 lines)
- [ ] [prep] [uikit-import-components-page](roadmap/M2.5/uikit-import-components-page.md) — `#/components` gallery + sandbox document model, store, templates, demo data (~920 lines)
- [ ] [prep] [uikit-import-sandbox](roadmap/M2.5/uikit-import-sandbox.md) — mock editor canvas, viewport, panel sections, spread renderer (~970 lines)
- [ ] [prep] [uikit-import-editor-chrome](roadmap/M2.5/uikit-import-editor-chrome.md) — mock editor chrome + inspector, demo parts, feature registry and types (~850 lines)
- [ ] [prep] [uikit-import-pages-m0-m2-5](roadmap/M2.5/uikit-import-pages-m0-m2-5.md) — M0–M2.5 feature pages (~860 lines)
- [ ] [prep] [uikit-import-pages-m3-m4-5](roadmap/M2.5/uikit-import-pages-m3-m4-5.md) — M3–M4.5 feature pages + app screens (~910 lines)
- [ ] [prep] [uikit-import-pages-m5-m8](roadmap/M2.5/uikit-import-pages-m5-m8.md) — M5–M8 feature pages, demo photos + `PHOTO-CREDITS.md` / `credits.json` (~980 lines; photos excluded)
- [ ] [prep] [uikit-import-qa](roadmap/M2.5/uikit-import-qa.md) — headless `qa` / `shots` scripts (local Chrome via `CHROME_PATH`), `qa:quick` step in the `uikit` CI job (~300 lines); **Done when:** `qa` in `uikit/` passes with no missing demo, no clipped demo and no console errors in both themes at 1440×900 and 1280×800
- [ ] [feature] [missing-assets-relink](roadmap/M2.5/missing-assets-relink.md) — moved photo folders
- [ ] [prep] [design-reference](roadmap/M2.5/design-reference.md) — visual language and agent rule
- [ ] [feature] [design-tokens](roadmap/M2.5/design-tokens.md) — tokens and self-hosted fonts
- [ ] [prep] [icon-set](roadmap/M2.5/icon-set.md) — icons (Security Review: dependency, if a package is chosen)
- [ ] [prep] [ui-primitives-actions](roadmap/M2.5/ui-primitives-actions.md) — action primitives in `src/ui/`
- [ ] [prep] [ui-primitives-feedback](roadmap/M2.5/ui-primitives-feedback.md) — feedback primitives in `src/ui/`
- [ ] [prep] [visual-regression-e2e](roadmap/M2.5/visual-regression-e2e.md) — screenshot tests (issue #8)
- [ ] [prep] [a11y-contrast-gate](roadmap/M2.5/a11y-contrast-gate.md) — contrast checks on the design system
- [ ] [feature] [editor-chrome-toolbar](roadmap/M2.5/editor-chrome-toolbar.md) — editor bars on primitives
- [ ] [feature] [editor-chrome-states](roadmap/M2.5/editor-chrome-states.md) — editor states on tokens and primitives
- [ ] [feature] [project-screens-adoption](roadmap/M2.5/project-screens-adoption.md) — M2 screens on the design system
- [ ] [feature] [dark-theme](roadmap/M2.5/dark-theme.md) — dark neutral theme

## M3 — Building a real book

**Review cut:** you can assemble a complete real book from your own photos without reaching for InDesign — orientation-aware templates and multi-photo drops make layout fast, the assets panel shows what is used, missing or modified — and a 1000-photo library feels instant.

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

- [ ] [prep] [hosting-decision](roadmap/M7/hosting-decision.md) — spike
- [ ] [feature] [manual-deploy](roadmap/M7/manual-deploy.md) — documented deploy path
- [ ] [feature] [publish-credentials](roadmap/M7/publish-credentials.md) — connect the editor to your hosting (Security Review)
- [ ] [feature] [in-app-publish](roadmap/M7/in-app-publish.md) — publish button (Security Review)

## M6 — Print

**Review cut:** a PDF (pages or spreads, as the print shop wants) or JPEG spreads you can send to a print shop, a cover with the right spine, and a booklet you can print at home; low-resolution photos are flagged on their frames while you lay out; exporting never freezes the editor.

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

## Archive

- [M0 — Foundation (done)](roadmap/archive/M0/README.md)
- [M1 — Editor skeleton](roadmap/archive/M1/README.md)
- [M2 — Project on disk](roadmap/archive/M2/README.md)
