# parent-overrides-copy-reselect

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item parent-overrides-copy-reselect

Bug: after a click elsewhere, an override copy fully covered by an own frame cannot be selected again with Ctrl/⌘+Shift. Designer decision (tracker, parent-overrides-canvas review 3): a Ctrl/⌘+Shift press checks override copies first (topmost, rotation-aware), then parent items; a copy hit selects the copy and moves it past 3 px, with no new override and no undo step.

## Scope

- [ ] `src/editor/parentHit.ts`: hit order copies → parent items, rotation-aware, topmost wins; unit tests for a covered copy, a rotated copy, overlapping copies (topmost) and no copy → parent item.
- [ ] Every caller of the parentHit functions goes through the new order; the PR body lists each caller as fixed or left out with a reason.
- [ ] e2e `e2e/parent-overrides-reselect.spec.ts`: click away, Ctrl+Shift press on the covered copy selects it; a drag past 3 px moves it; the reselect adds no undo step (DOM checks).
- Out: kit `uikit/` order (`parent-overrides-kit`), inspector / context menu files, `e2e/parent-overrides.spec.ts`.
- **Browser check:** painter fixture with Master A: override the logo under an own frame, click away, Ctrl+Shift press the logo area → copy selected; drag → it moves; the Undo label is unchanged by the press.

## Done when

- Unit tests and the new e2e green; typecheck green; PR open with the caller list.
