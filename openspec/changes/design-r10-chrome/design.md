## Decisions

1. Root fix: `styles/app.css` adds the kit preflight `button` rule (font, font features / variations, letter-spacing, colour: inherit) inside `@layer base`, so utilities and unlayered component CSS still win. Buttons only. The e2e Arial audit guards it.
2. Pages/Masters (`LeftPanel`, `EditorShell.css`): kit `SegC` geometry, with flush `h-6.5` segments in a 2 px track.
3. "Add folder…": a `film-add-folder` modifier on `.film-chip` (`editorChromeTokens.ts`); the other chips are unchanged.
4. Layout picker: the kit Section carries `group`, so every caption inks while the pointer is over the section. Prod uses `.pb-disclosure:hover .layout-tile-name`. Tabs are muted, and ink when pressed.
5. Create book: the kit renders under preflight. Rules scoped to `.pb-create-dialog` set the section gap, the title size, the label line boxes, the `p` margins and the Cancel ink. `ListSelect` is used only here and takes the kit Select line-heights and popover border. Values follow roadmap M58 / M62 / M63.

## Touch-set & Test Plan

- Files: `styles/app.css`, `src/editor/{CreateBookDialog.tsx,LeftPanel.tsx,EditorShell.css,FilmstripDock.tsx,editorChromeTokens.ts,LayoutSection.css}`, `src/ui/ListSelect.css`, `docs/design.md`, new `e2e/design-r10-chrome.spec.ts`.
- Reuse: `--leading-menu`, `--foreground`, `--muted-foreground`, `--border`, `--text-xl`.
- Tests: the e2e spec's header records the kit values. It covers the dialog rows, menu pitch, Custom row and Cancel ink; the toggle, list, Add folder and Settings fonts; caption colours at rest and on hover, and the tab colours; and the Arial audit over the walked states. The `CreateBookDialog`, `LeftPanel`, `FilmstripDock` and `LayoutSection` unit tests stay green.
