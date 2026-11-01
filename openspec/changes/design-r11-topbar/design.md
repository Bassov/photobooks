## Decisions

1. Panel toggles keep `aria-expanded` (a11y contract, prod tests); the runtime chrome rule `.e7-tog[aria-pressed=true]` never matched, so it also selects `[aria-expanded=true]` (`--field`, wins over `.e7-ghost:hover` by order). Toggles get inline `SUB` colour and `p-0` (kit `style={{ color: SUB }}` + preflight).
2. Preview and Settings: `ChromeButton` pills on `--field` with a local class `editor-top-pill` in a new `EditorTopBar.css` (radius 9999, padding 0 12, `T` colour) — `.pb-button--sm` beats the layered `rounded-full px-3` utilities. Preview drops `e7-sec` (kit Preview keeps 215 on hover). Both sit in a `gap-1.5` group.
3. Undo / Redo: `IconButton size="md"` (32), history group without the 2 px gap (kit `HistoryButtons`).
4. Zoom menu: drop the inline transparent style and `min-w-[4.75rem]`; `editor-zoom-menu` sets padding 0 8 and gap 4 so `.pb-button--ghost` hover (accent / foreground) applies. The zoom group sits left of fixed-width items in the right grid track, so narrowing it does not move the centred tool group or the canvas.

## Touch-set & Test Plan

- Files: `src/editor/EditorTopBar.tsx`, new `src/editor/EditorTopBar.css`, `src/editor/EditorFrame.tsx` (`PanelToggles`), `src/editor/editorChromeTokens.ts` (`.e7-tog` selector), `docs/design.md` (one line).
- Reuse: `ChromeButton`, `IconButton`, `Button` ghost, tokens `FIELD` / `SUB` / `T`.
- Tests: unit — `EditorTopBar.test.tsx` (pill classes, md history buttons, zoom menu class), `editorChromeTokens.test.ts` (toggle-on selector). e2e — new `e2e/design-r11-topbar.spec.ts`: kit values for every control state (incl. hover on an ON toggle); x of each item vs kit ≤0.5 px; bar height 48. r4 / r7 / r10 specs re-run.
