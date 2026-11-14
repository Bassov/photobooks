## Decisions

1. `PrintDialog` keeps its props (`pages.tsx` / `editor.tsx` are off-lane); the imposition segmented stays behind `const IMPOSITION: boolean = false` (D3).
2. The check is a kit stand-in in pure `printCheck.ts`, read from `useStudio()` (the dialog renders in the studio overlay): core rule ids, severities and order; safe-zone / bleed-hazard stay with core. 800 ms "checking" on open and on a profile change; Export PDF never disabled.
3. Run = existing rAF `useRun` (1400 ms; qa.mjs waits 1900). The run step is dismissable; Hide / Esc / outside close the dialog (the job outliving it lands with the pill item).
4. Failed is seeded by `window.__printDemo.fail(kind)` (kit-only hook like `__demo.missing()`, never in prod).
5. Security: Open PDF opens a static sample-PDF blob (no user data) in a new tab whose `opener` is cut (`noopener` leaves a blob tab blank in Chromium), revoked after 60 s.

## Touch-set & Test Plan

| File                                 | Why                          |
| ------------------------------------ | ---------------------------- |
| `uikit/src/demo-parts/dialogs.tsx`   | PrintDialog §2.1–2.4         |
| `uikit/src/demo-parts/printCheck.ts` | check rows, texts, demo hook |
| `e2e/kit-pdf-export.spec.ts`         | DOM measure + PE1–PE3 states |
| `docs/roadmap/P4/pdf-export-kit.md`  | item scope from the brief    |

- Reuse: `AppModal`, `Button size="md"`, `Checkbox`, `Progress`, `useRun`, `effectiveDpi`. Tokens (kit `index.css`): error `text-destructive-solid` 500 (#232223; accent never text), warning `text-warning-fg`, info / labels `text-muted-foreground`, bar `bg-secondary`. Skill `ui-review` before push.
- Tests: e2e (kit has no unit lane): box / title / button metrics, options + bleed summary, checking → issues (order, counts, page lists, 118.25 cap + scroll, error note), clean, run + Esc, done + Open PDF + skipped row, failed + Try again.
