## Decisions

1. **The run outlives the dialog.** `DemoEditor` owns `useExportRun()` (on `useRun`): Hide unmounts the dialog, the pill keeps running. `ExportSiteDialog` takes an optional `run` (else its own) and follows it in place.
2. **The pill is a pure view with a fixed size.** `EditorTopBar` gets the run phase + progress as props. A hidden sizer with the rest content shares one grid cell with the live content, so every state keeps the rest width; labels drop below 1280 px (icon-only, like Settings). Accessible name stays "Export site".
3. **Kit stand-ins.** The kit `FolderPicker` chooses the folder; one picker folder ("Family") triggers the "not a Photobooks export" failure so `failed` is reachable in `#/demo`; Done shows plausible numbers derived from the book count.
4. **Tokens:** kit Publish frame, `docs/design.md`; none new.
5. **KS1 at 1440 (found in apply):** with kit-ahead Print · Publish the end group overflows by 29.5 px, so the tools move 14.75 px left; `qa.mjs` KS1 expects that exact shift (prod stays centred). Designer to confirm.

## Touch-set & Test Plan

| Path                                   |
| -------------------------------------- |
| `uikit/src/demo-parts/dialogs.tsx`     |
| `uikit/src/demo-parts/editor.tsx`      |
| `uikit/src/features/pages.tsx`         |
| `uikit/src/kit/pages.json`             |
| `uikit/scripts/demo-capture.mjs`       |
| `uikit/scripts/qa.mjs`                 |
| `docs/roadmap/P3/static-export-kit.md` |

- Reuse: `useRun`, `AppModal`, `Button`, `Progress`, `FolderPicker`, `EditorView`.
- Tests: no prod tests. Kit typecheck, build, `uikit:qa:quick`, `#/demo` walk; scratch DOM measure (pill states at 1440 / 1200, dialog), numbers in the PR.
