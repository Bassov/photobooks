## Implementation

- [x] 1. `printCheck.ts`: check rows (rules, order, texts, page lists ≤ 5 then +n), label, summary, progress text, fail texts, `__printDemo` hook.
- [x] 2. PrintDialog options (PE1): hidden segmented behind `IMPOSITION`, Imposition row, bleed checkbox test id, D5 summary.
- [x] 3. PrintDialog Check block (PE2): checking / clean / issues, row styles, 118.25 px cap, error note.
- [x] 4. PrintDialog run / done / failed (PE3): dismissable run + Hide, page progress, done with saved path, skipped row, Open PDF, failed + Try again.
- [x] 5. `e2e/kit-pdf-export.spec.ts`: DOM measure + every PE1–PE3 state in `#/demo`.

## Manual test scenarios

1. Kit `#/demo` → create a book → Print: Imposition · 1 per sheet, Check settles to issues, bleed off → "trim size, no marks".
2. Export PDF → "Page i of n · p%", Esc hides; Export again → PDF ready, Open PDF opens a tab.
3. `__printDemo.fail("access")` → failed text, Try again → PDF ready.

- Harness problem: `manual-qa` drives the prod editor shell only and cannot open the kit `#/demo` stand; scenarios walked by Playwright instead.
- OK 1: `e2e/kit-pdf-export.spec.ts` "PE1 options…", "PE1 bleed label…", "PE2 check: checking, then issues…" (9/9 local, 1440×900).
- OK 2: same spec "PE3 run: page progress, 6 px bar, Esc hides; done with Open PDF" (Open PDF opens a `blob:` `application/pdf` `%PDF-1.4`) and "PE3 run: Hide and an outside click hide it".
- OK 3: same spec "PE3 failed: access / full / other texts, Try again exports"; kit `uikit:qa:quick` 375/375 (print-go → print-done → print-close, `print-summary`, `print-size`).
