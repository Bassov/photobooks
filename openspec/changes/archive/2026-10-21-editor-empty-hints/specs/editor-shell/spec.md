## ADDED Requirements

### Requirement: Empty editor and first placement guidance

When the book gallery is empty, the pasteboard SHALL show an EmptyState card titled "Start with your photos" with a short description and keyboard-reachable primary "Add folder…" and secondary "Add photos…" actions that use the same import path as the editor top bar. When the gallery has photos and no frame has an `assetId`, the pasteboard SHALL show a non-blocking placement hint ("Drag a photo onto a frame, or click a photo and then a frame.") that does not intercept frame hit targets (`pointer-events: none` except card action buttons). The hint SHALL disappear when any frame gains an `assetId` and MUST NOT appear when the book already has placements. An import that adds zero gallery photos while the gallery remains empty SHALL keep the empty card and MAY show a secondary line "No photos found in that folder". The polite editor Status SHALL announce the placement hint once when it appears (not on every re-render). This guidance is in-editor only; first-run onboarding (sample book / tour) is out of scope and MUST reuse this card later rather than add a second empty state.

#### Scenario: Empty gallery shows import card

- **WHEN** the editor is open and `book.gallery` is empty
- **THEN** the pasteboard EmptyState card is visible with Add folder… and Add photos… actions that open the shared import path

#### Scenario: Placement hint until first place

- **WHEN** the gallery has at least one photo and no frame has an `assetId`
- **THEN** the placement hint is visible and the polite Status announces it once

#### Scenario: Hint clears on first placement

- **WHEN** any frame receives an `assetId` (or the book already has placements on load)
- **THEN** the placement hint is not shown
