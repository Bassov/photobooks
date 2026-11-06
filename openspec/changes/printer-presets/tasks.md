## Implementation

- [x] 1. Core: `basedOn`, `refreshPrintProfile`, `resolveSpread` customs option.
- [x] 2. `printProfilesStore.ts` + `printProfileDraft.ts` (unit / PBT); bind in `projectSession`.
- [x] 3. History snapshot `printProfile`; bookStore customs + paint key; low-res callers pass customs.
- [x] 4. Settings: `print` row, aria-current on the current row; Print presets (default select, shops, Duplicate → editor, New profile, Edit…, More menu, Delete AlertDialog, empty row).
- [x] 5. Editor dialog: groups, table-spine row, live errors, Save disabled, Esc / Enter, scrolling body.
- [x] 6. Book settings PRINT: Printer select, hint, warnings, "Printer: {name}" live region, B/S `mt-3`, Pages range (D5).
- [x] 7. Tests: updated unit / e2e, new `e2e/printer-presets.spec.ts` + `print-profile-switch` gate.
- [x] 8. Roadmap: move the two out-of-item criteria to `P4/preflight-core.md` / `P4/pdf-export.md`.

## Manual test scenarios

1. Settings → Print presets: empty Custom row; Duplicate Generic opens the editor; save; the row shows its summary.
2. Editor: empty name, odd step, Minimum above Warn under → messages, Save disabled.
3. Book settings → Printer: pick the custom; hint and B/S follow; Cmd+Z restores Generic.
4. Delete the custom the book uses: the book keeps its values; a deleted default falls back to Generic.
