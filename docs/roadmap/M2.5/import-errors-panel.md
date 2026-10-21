# import-errors-panel

Tag: feature
Milestone: M2.5
Title: import errors you can dismiss, clear, group by reason and jump from
Status: done

## Scope

- [x] Error model: `ImportFileError` (`src/photo/assetPool.ts:39-42`) gets `reason: 'unsupported-type' | 'heic' | 'decode-failed'` set where errors are made (`partitionImportFiles` `src/photo/pickPhotos.ts:92-110`, the HEIC path, the `runImportBatch` catch `assetPool.ts:478-484`) and a stable `id` (fixes the shared React key `${name}:${message}`, `src/editor/EditorShell.tsx:384-385`). Keep `assetId` from `failed-import-no-tile`
- [x] Error state out of `EditorShell` local state (`EditorShell.tsx:82,88,107`) into a small import-errors store (ops: add batch, dismiss id, clear all; `useSyncExternalStore` with stable snapshots). Decide and document: a new import appends its errors to the list (does not wipe unrelated errors). The existing `setErrors([])` at the start of each import (`:88`) goes away
- [x] Panel opened by the `editor-chrome-states` toast action ("Show files") and from the filmstrip status (`src/editor/FilmstripStatus.tsx:17` "Imported with N error(s)"): built on the `ui-primitives-feedback` Popover/Dialog + Button primitives. Groups by reason with a count and file names ("Unsupported format (3): a.tif, …"), each group collapsible; each entry has a labelled dismiss (×) button; one "Clear all"
- [x] Jump to tile: an entry whose `assetId` is still in `book.gallery` is a button that scrolls the filmstrip to that tile (scrollLeft = stride prefix offset, `src/editor/Filmstrip.tsx:75,108-133`), selects it (`setSelectedAssetId`, `src/editor/gallerySelection.ts:28`) and briefly highlights it (one attribute). Entries without a tile say "Not imported". Note: after `failed-import-no-tile`, decode and type failures have no tile, so in practice the link applies to errors on assets that stay in the gallery
- [x] a11y: new errors are announced once through a polite Status (not `role="alert"` as at `EditorShell.tsx:382`); dismiss buttons have labels ("Dismiss error for a.tif"); focus returns to the trigger on close
- [ ] Not in scope (owned by `editor-chrome-states`): the toast itself, its look, tokens, placeholder and Placed badge styling
- [x] Tests: unit for the store (dismiss, clear all, append, grouping, stable snapshot) and the reason mapping; component tests through public props; e2e: import a batch with 2 unsupported + 1 corrupt + valid photos, open the panel, groups show counts 2 and 1, dismiss one, Clear all empties it, and a linked entry scrolls a tile into the filmstrip viewport with `aria-selected`/selection set
- **Done when:** (1) an e2e regression test for #44 (no way to dismiss, clear or group on main) passes on the branch; (2) grouping, dismiss, clear-all and jump are covered by unit + e2e; (3) the `editor-shell` spec delta (import error presentation) is archived; (4) patch coverage ≥ 85%, Stryker diff ≥ 85 with zero NoCoverage, no gate weakened or newly excluded; (5) existing filmstrip and import e2e stay green with updated selectors
- **Perf:** grouping is computed once per import result, not per render; the panel mounts lazily; jump-to-tile is one scroll write + one attribute. Gate: filmstrip import scenario with failing files — zero LoAF; opening the panel with 200 errors stays under the handler budget.
- **Browser check:** import a folder with several broken and unsupported files. The toast's "Show files" opens a panel grouped by reason with counts; dismiss one entry, then Clear all; an entry for a photo still in the gallery scrolls the filmstrip to it and highlights it; keyboard-only works with visible focus; no page-level H/V scroll.
- **UI ref:** `uikit#/feature/editor-chrome-states` (error scenario)
- **UI kit:** `uikit/src/features/m25.tsx:113-140` (ChromeStates "Import error" scenario, toast + "Show files" action), `uikit/src/features/m25.tsx:222-229` (notes), `uikit/src/components/ui/toast.tsx`, `uikit/src/components/ui/popover.tsx`, `uikit/src/components/ui/dialog.tsx`, `uikit/src/components/ui/disclosure.tsx` (collapsible groups), `uikit/src/components/ui/button.tsx`. The kit has no grouped error panel; the grouping/dismiss layout is new and gets added to the design reference / `?specimen` in this change
- **Size:** ~300–450 changed lines (error model + store + panel + jump + tests)
- **Source:** #44

## Done note

Import errors store + grouped Dialog panel; dismiss/clear/jump; editor-shell spec archived
