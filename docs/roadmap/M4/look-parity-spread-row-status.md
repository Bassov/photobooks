# look-parity-spread-row-status

Tag: feature
Milestone: M4
Title: look parity: spread row menu, status pill, template bar removal
Status: done

## Scope

Look parity (Owner 2026-10-29: the editor must look exactly like the UI kit `uikit/` v0.9.3; no fake / disabled controls). Three small kit items; no new behaviour, shortcuts or template UI.

- [x] Spread row "…" menu (kit `SpreadMenu`): hover / selected / focus-visible trigger on the row, popover `w-44` with `Add after`, `Duplicate`, a separator and a destructive `Delete` (disabled with one spread); shortcut hints only for really bound keys (Ctrl+↵ add, Ctrl+D duplicate, Del delete — `spreadsKeyAction`); same testids and `run()` actions
- [x] Visible status pill (kit `StatusLine`): the `editor-status` live region becomes the kit pill over the canvas (bottom-left), hidden when empty and in Presentation; `editorStatus.ts` contract and testid unchanged
- [x] `SpreadTemplateBar` removed from above the canvas (mount, component, test, CSS); templates live in the inspector Layout section (Designer), Add spread in the Spreads panel (`add-spread`), contact sheet in the inspector (`layout-contact-*`); e2e moved to those surfaces

**Done when:** the spread row menu matches the kit; a status message shows as a pill at the canvas bottom-left and disappears when cleared; no template bar above the canvas and nothing lost (Add spread, templates, contact sheet); no accent colour.
**Browser check:** hover a spread row → "…" → Duplicate; trigger a status message (e.g. undo) → pill visible; canvas starts directly under the top bar.
**Perf:** CSS / static elements only; the pill subscribes to the existing status store; zero LoAF.

- **Kit components:** `SpreadMenu` (`uikit/src/sandbox/chrome.tsx` l.351-362), `StatusLine` (l.553-556); the template bar has no kit counterpart (templates are `LayoutSection`).
- **Demo:** `uikit/src/sandbox/chrome.tsx`
- **Musts:**
  - Row-menu trigger + items + separator + real key hints only; visible status pill; bar removed with no loss of Add spread / contact sheet.
  - Grayscale tokens only.
- **Hard nos:** no fake or disabled controls (Delete's real disabled state is fine); no new shortcuts or behaviour; no new template UI; no filmstrip / dock, inspector sections, rulers or top bar changes.
- **Tokens:** `--popover`, `--muted-foreground`, `--ring`, `--text-xs`, `--shadow-sm`.
- **Test:** unit — separator before Delete, hints only for bound actions, Delete disabled with one spread; pill hidden when empty and shows `editorStatus` text; Pasteboard has no `template-add-spread`. e2e — row menu Duplicate; a status message makes the pill visible.
- **Depends:** topbar-kit-parity, inspector-spread-book, spread-list-panel
