## Decisions

1. `usePublishRun` sits beside `useExportRun` in `dialogs.tsx`; `DemoEditor` owns both runs, so Hide closes the dialog and the pill keeps running.
2. `PublishDialog` mirrors `ExportSiteDialog`: dismissable in every step (run hides), and the run moves to done / failed in place. `connect` when `useDemo().hosting` is null.
3. "Open Settings → Hosting" needs the section to survive the stage switch: a new optional `SessionState.settingsSection`, read by `DemoSettings` (`initialSection ?? d.settingsSection`); the Settings pill clears it. This is the minimum for the Spec's Settings entry.
4. One shared site-job pill for Export site and Publish (rest-label sizer, `NN%` over the fill, `role="status"`); Publish has no icon at rest, padding 0 14. P7 disables each pill while the other runs.
5. Tokens: fill `bg-control` (#BEBEBE), dialog `AppModal` (chrome #E1E1E1, r 14), pills `#D7D7D7` as Export site — all existing kit values, no new tokens. Skill `ui-review` before push.

## Touch-set & Test Plan

| Path                                | Why                    |
| ----------------------------------- | ---------------------- |
| `uikit/src/demo-parts/dialogs.tsx`  | dialog steps, run hook |
| `uikit/src/demo-parts/editor.tsx`   | pill, P7, 1360, wiring |
| `uikit/src/demo-parts/settings.tsx` | session section        |
| `uikit/src/demo-parts/session.tsx`  | `settingsSection`      |
| `uikit/src/features/pages.tsx`      | seven states           |
| `uikit/scripts/demo-capture.mjs`    | new step               |
| `e2e/kit-in-app-publish.spec.ts`    | K1–K3                  |
| `e2e/kit-hosting-settings.spec.ts`  | KM3 bold host          |

- Tests: e2e K1–K3 with clipped-screenshot paint probes (running fill, dialog bg); uikit typecheck + `qa:quick`; demo baseline regenerated locally.
