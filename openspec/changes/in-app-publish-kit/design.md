## Decisions

1. `usePublishRun` sits beside `useExportRun` in `dialogs.tsx` (same shape: `phase`, `p`, `fail`, `start`, `seen`); `DemoEditor` owns both runs, so Hide closes the dialog and the pill keeps running. No session state (`session.tsx` untouched).
2. `PublishDialog` mirrors `ExportSiteDialog`: `AppModal isDismissable` in every step, `onHide` for Esc / outside click / Hide, and an effect that moves `run` to `done` / `failed` in place. `connect` is the first step when `useDemo().hosting` is null; "Open Settings → Hosting" calls `onOpenHosting` (DemoEditor sets `stage: "settings"` + `back: "editor"` and a hosting section).
3. The Settings section to open travels in a new optional `SessionState.settingsSection`; `DemoSettings` opens `initialSection ?? d.settingsSection`, so `#/demo` and feature-page roots both honour it. The top-bar Settings button clears it.
4. The Publish pill reuses the Export site pill: one `SiteJobPill` with a per-pill text table (sizer = rest label "Publish", no icon at rest, padding 0 14). P7: each pill is disabled while the other runs, with the Spec `title` on the wrapper.
5. Feature-page states pass `run` / `initialStep` / `fail` props, as `static-export` does; `run-hidden` is the pill only at 42 %.

## Touch-set & Test Plan

| Path                                | Why                                                 |
| ----------------------------------- | --------------------------------------------------- |
| `uikit/src/demo-parts/dialogs.tsx`  | `PublishDialog` steps, `usePublishRun`              |
| `uikit/src/demo-parts/editor.tsx`   | shared pill, P7, 1360 breakpoint, DemoEditor wiring |
| `uikit/src/demo-parts/settings.tsx` | `DemoSettings` opens the session's section          |
| `uikit/src/demo-parts/session.tsx`  | optional `settingsSection`                          |
| `uikit/src/features/pages.tsx`      | seven `in-app-publish` states                       |
| `uikit/scripts/demo-capture.mjs`    | `publish-running-hidden`; publish-done via the pill |
| `e2e/kit-in-app-publish.spec.ts`    | K1–K3                                               |
| `e2e/kit-hosting-settings.spec.ts`  | KM3 host line (bold host)                           |

- Reuse: `useRun`, `AppModal`, `Progress`, `Button`, the Export site pill grid-cell sizer.
- Tests: e2e K1–K3 incl. a clipped-screenshot paint probe of the running fill (#BEBEBE) and the dialog bg; uikit typecheck + `qa:quick`; demo baseline regenerated locally.
