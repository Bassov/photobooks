---
name: write-tests
description: >-
  Photobooks test authorship — public API only, shared fixtures/helpers, mock
  boundaries, AAA, Vitest + Playwright + PBT. Use when writing or reviewing
  unit, property, or e2e tests, or when tempted to reach into private module
  internals for coverage.
---

# Writing tests

## Public API first

- Exercise exported functions, types, and component props/DOM contracts.
- Do **not** import private helpers, poke `#` fields, or cast `as any` to reach internals.
- If the public surface cannot express the scenario: search for an existing test seam or fixture; only then extend the **public** API in the same change (testability debt is a product fix).

## Shared setup and helpers

- Prefer factories: `makeX(overrides)` / fixture generators under `e2e/fixtures/` or `*.test-helpers.ts`.
- Suite-level `beforeAll` / Vitest `test.extend` for expensive shared read-only setup; fresh mutable state per test.
- If the same Arrange block or helper appears in 2+ tests/suites, extract and reuse — do not copy-paste.

## Mocking

- Mock boundaries: filesystem, network, timers, worker `postMessage` edges, injected deps.
- Keep pure domain logic real; prefer `@fast-check/vitest` for pure functions.
- Do not assert call counts on internal helpers; assert observable results/errors.
- Restore mocks between tests (`vi.restoreAllMocks` / project defaults).

## Structure

- AAA (Arrange / Act / Assert) with blank-line separation where it aids reading.
- Names describe behavior (`returns … when …`), not `test 1`.
- No branching/`for` in a test body — use `it.each` or PBT.
- Always `await` async assertions; use `vitest run` (not watch) in agents.

## E2E (Playwright)

- Prefer `getByRole` / `getByTestId` over CSS/XPath tied to layout.
- Reuse fixture files and generators; do not inline binary setup in every test.
- One user-visible behavior per test when practical.
- For scrollports: reuse `assertDocumentFitsViewport` / `assertNamedScrollport` from `e2e/fixtures/`; do not treat element `scrollLeft` alone as proof the page fits the viewport.
- **UI change minimum:** when UI is in scope, lock in empty + happy-path + primary interact/scroll before treating apply as complete. Observable success-criteria claims (geometry, packing, empty copy, viewport fill) need matching assertions — not only LoAF / item counts.
- **Virtualized / variable-size lists:** assert the mounted window covers the scrollport mid-scroll while more items remain; do not rely on a fixed `WINDOW_SIZE` or progressive-reveal lag tests alone.
- **Empty beside a virtualizer:** assert empty-state geometry (width/height), not merely that the node exists — empty must not share a 1px sliding window.

## Anti-patterns (fail review)

- Deep imports of non-exported symbols to “make the test pass”.
- Duplicated local `setup()` / `createFoo()` across files with tiny diffs.
- Snapshot-everything or brittle exact log string matching.
- Testing third-party library behavior instead of our adapters.
- Shipping a UI PR with only unit helper coverage for layout claims that a 30s manual pass would catch (empty crush, mid-scroll holes, max-stride gaps).
