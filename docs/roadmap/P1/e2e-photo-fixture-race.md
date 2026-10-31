# e2e-photo-fixture-race

Tag: lite
Milestone: P1
Title: Fix: e2e photo fixtures are rewritten while other workers import them

## Scope

## Scope

- [ ] `e2e/fixtures/write-*.mjs` write each photo fixture atomically (temp file in the same dir, then `renameSync`) or skip the write when the bytes already match, so a parallel worker never reads a half-written file.
- Seen in design-r2-spread-list: `spread-reorder.spec.ts` "switching a template keeps photos in order and unplaces extras" failed 1/30 twice under `--repeat-each=30` (7 workers, both at repeat3). The gallery showed "Imported with 1 error(s)" and `Photos · 1`: `sample-3x2.png` was rewritten by another worker's `ensurePhotoFixtures()` while this test imported it. The test passes 30/30 when run alone.
- **Done when:** `pnpm exec playwright test e2e/spread-reorder.spec.ts --repeat-each=30` and a multi-spec burn-in that calls `ensurePhotoFixtures()` from several workers are green with no import error; no assertion is changed.
