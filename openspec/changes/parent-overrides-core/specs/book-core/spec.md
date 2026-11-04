## ADDED Requirements

### Requirement: Parent overrides ops

A spread SHALL override a resolved parent frame or guide (`overrideParentFrame` / `overrideParentGuide`: a copy with a new id and `overridesId` in `parentOverrides`), hide one (`hideParentItem`: removes its copy, adds the id to `hiddenIds`), reset one (`resetParentItem`: removes copy and hidden id) or reset all (`resetSpreadToParent`: removes `parentOverrides`); empty override lists are dropped, so override then reset restores the spread. Every frame op addressed by spread and frame id (move, resize, rotate, rect, photo, swap, crop, fit, caption, adjust, style, lock) SHALL also edit a copy, which keeps its `overridesId` and never detaches the template; later parent edits never touch a copy. Changing the parent a spread resolves to (set, delete, new book default) SHALL keep the work in the same history step: copies become own frames below the lowest own z in their order without `overridesId`, copy guides become own guides, hidden ids are dropped. Each op MUST be one history step and MUST notify only its spread; a parent edit MUST NOT notify a spread whose painted parent frames are unchanged.

#### Scenario: Override, then switch master

- **WHEN** spread 2 overrides Master A's logo, moves the copy, and then switches to Master B
- **THEN** the moved logo is an own frame of spread 2 under its other frames, without `overridesId`, and one undo restores the copy and Master A
