## MODIFIED Requirements

### Requirement: Spread master and background

Applying a parent to a spread SHALL store `parentId` (a parent id, or `null` for None) only when it differs from what an absent field resolves to (the book default, else None); otherwise the field SHALL be removed. An unknown parent id or the spread's current parent MUST leave the book unchanged; a stored `masterId` (the former Master A / B switch) is dropped at load. A spread MAY store `backgroundColor` (sRGB hex; absent means the book page colour); clearing the colour SHALL remove the field. Each change MUST be one history step touching only that spread. The resolved spread SHALL list the applied parent's frames (minus hidden / overridden, plus local copies) first, flagged as parent items, then the spread's own frames in stored order; canvas, spread list and presentation SHALL paint parent items beneath every spread frame, and they MUST NOT be selectable, draggable or drop targets.

#### Scenario: Parent round-trip

- **WHEN** a book without a default parent applies parent P to spread 1, then None, then P again
- **THEN** spread 1 stores `P`, then no `parentId`, then `P`, and other spreads are unchanged

#### Scenario: Parent items paint beneath

- **WHEN** parent P has one frame with `z` 99 and spread 1 (one frame, `z` 1) uses P
- **THEN** the resolved spread lists P's frame first as a parent item, and the canvas paints it below the spread frame and selects nothing when it is clicked
