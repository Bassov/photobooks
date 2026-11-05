## ADDED Requirements

### Requirement: Parent guide override and hide

With the Select tool and guides shown, a primary press with Shift and Ctrl or ⌘ within 4.5 screen px of a parent guide on a spread SHALL override it (`overrideParentGuide`, "Override parent guide") and continue as the copy's drag. The copy SHALL paint and behave as an own guide (solid, draggable, snapping) on that spread only; a move is its own history step. Dropping the copy on its ruler or off the spread SHALL hide the parent guide on that spread (`hideParentItem`, "Hide parent item"). A hidden parent guide SHALL neither paint nor snap.

#### Scenario: Override, then hide on the ruler

- **WHEN** the user Ctrl+Shift-drags a Master A guide on one spread 40 px, then drags the copy onto its ruler
- **THEN** after the first drag a solid guide sits 40 px away and no parent line remains on that spread while other spreads keep it; after the second no guide is shown there and a frame drawn at the old position does not snap to it
