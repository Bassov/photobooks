## Implementation

- [x] 1. `printProfiles.tsx`: `KitProfile`, sample catalog (Generic + shops, D8 note), summary / spine-hint helpers, `profileIssues`, `PrintProfileDialog` (560 / r14 / 20 24, 132 px labels, 96 / 64 fields, four groups, table spine read-only, error ring + message, Save disabled).
- [x] 2. `session.tsx` + `root.tsx`: custom profiles + default id in the kit session; `settings.print` seed for the editor scenarios.
- [x] 3. `settings.tsx`: Print presets section (lead, default select 240 × 32, Print shops, Custom + New profile, Edit… + ••• menu, empty state, Delete… confirm, default → Generic); stub rows removed; `settings-nav-<id>` test ids.
- [x] 4. `dialogs.tsx` + `editor.tsx`: PrintDialog Printer row (`print-profile`), profile bleed in the checkbox label and summary.
- [x] 5. `pages.tsx` `site-settings`: scenarios print / print-empty / print-edit / print-invalid, `what` texts; Print page `what`.
- [x] 6. `uikit/scripts/qa.mjs`: printer-presets-kit asserts (DOM measured at 1440 × 900).

## Manual test scenarios

1. `#/full/site-settings` print: select 240 × 32, shop rows with summaries, Lulu Default badge, custom row Edit… + ••• (menu 176: Duplicate, Delete…).
2. Pick the custom profile in the Default select, then Delete… it → confirm → row gone, select shows Generic.
3. Duplicate a shop → editor "Edit print profile"; change Spine per page → hint updates; clear Name → ring + message, Save disabled.
4. `print-empty` shows the empty-state row; Print dialog shows "Printer · Generic" and "Add 3 mm bleed and crop marks".
