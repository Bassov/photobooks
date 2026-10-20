# Proposal

## Why

- Adding a spread always creates a one-per-page layout, even when the active spread uses 4-grid, 2-up, or full-bleed. Users expect the new spread to continue the template they were just editing.
- Owner decision 2026-10-19: inherit the active spread's template (option a). Issue #40.
- Why now: M2.2 pasteboard UX; the regression is easy to lock with e2e before more template work.

## What Changes

- Add spread inherits the active spread's template (one-per-page when none is active).
- Template control accessible name says it applies to this spread.
- Callers that omit a template keep today's one-per-page default.
- Unit, property, view, and e2e regression lock the behavior (e2e fails on main today).

## Scope out

- No session/bookStore caller changes; no schema bump; no new subsystem, deps, or gate edits; no reveal/camera redesign.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `pasteboard`: Requirement "Active spread template and add spread" — add-spread inherits active template; template control naming clarifies per-spread scope.

## Impact

- pasteboard template controls and spread-add behavior; tests for the regression. Session book construction unchanged.

## Success criteria

- e2e: fresh book → 4-grid → Add spread → new spread has four placeholders, radio stays 4-grid; scroll back to spread 1 still 4-grid; existing reveal/containment assertions pass. Same happy path for 2-up and full-bleed in browser check.
- Empty / no active: Add spread still yields one-per-page.
- Scroll: no page-level H/V scroll; reveal stays in the pasteboard scrollport; committed zoom kept (Perf / existing frame-budget cases green).
- Spec delta archived; `openspec validate` passes; patch coverage ≥ 85%; Stryker diff ≥ 85 with zero NoCoverage; no gate weakened.

## Risks

- Callers that omit a template keep one-per-page — intentional; do not change session/bookStore callers.
- Security surface: N/A.
