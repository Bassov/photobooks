# Proposal

## Problem

After Fit spread, Add spread sometimes leaves the new spread only partially inside the pasteboard scrollport. The strict containment e2e then flakes in CI even though the product requirement already says the new spread must lie fully within that scrollport and keep fitted zoom.

## Why now

Roadmap prep for M2.1 gate ratchet: Done when is 50/50 green on that strict assertion locally and in CI, without loosening the gate.

## Scope

- In: reliable full containment after add-spread at fit zoom; keep the existing strict assertion; local 50/50 proof; camera hold-scroll during pending reveal; fit viewport inset + delayed zoom-out-only re-fit so chrome settle does not overflow the pasteboard.
- Out: new zoom modes/algorithms unrelated to fit containment, scrollport redesign, weakening e2e gates, unrelated pasteboard features.
- UI: not newly in scope — reliability of the existing fitted-zoom add-spread path only (precondition: pasteboard with fitted active spread; happy path: add reveals fully contained new spread; scroll stays inside pasteboard via existing `assertDocumentFitsViewport` / `assertNamedScrollport('pasteboard-scroll')`, no page-level H/V scroll).

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- (none — `editor-shell` already requires lie-within pasteboard after layout and keep fitted zoom; implementation hardening only. `skip_specs: true`.)

## Success criteria

- Strict containment for “add spread keeps the fitted zoom and reveals the new spread” passes 50/50 locally and in CI.
- Zoom percent and previous-spread scale unchanged; new spread fully inside the pasteboard scrollport; no page-level H/V scroll.

## Risks

- Bounded settle on the add-spread path only — avoid fighting user scroll or adding noticeable latency.
- Racey settle could still flake under CI load; proof must be 50/50 in CI, not only local.
