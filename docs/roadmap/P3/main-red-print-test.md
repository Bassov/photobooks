# main-red-print-test

Tag: lite
Milestone: P3
Title: Bug: /next-roadmap-item main-red-print-test
Status: done

## Scope

- [x] Main is red since #624 (pdf-export) and #628 (booklet-imposition-core) landed together: #628 added the `impose` variant to `PdfWorkerRequest`, and the in-process worker fakes in `src/editor/print/startPrint.test.ts` read `request.paint` after only excluding `check` (TS2339 + `no-unsafe-argument`). The fakes handle all three request kinds; no other switch over `PdfWorkerRequest` in `src/` or `e2e/` misses `impose`.
- **Done when:** `pnpm check:fast` (typecheck + lint + unit) is green on the branch and the startPrint tests pass.
- **Browser check:** none (test-only change).

## Done note

Shipped by #630 (5ea5e71); Status: done backfilled by roadmap-status-sweep.
