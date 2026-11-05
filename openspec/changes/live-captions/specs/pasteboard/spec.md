## MODIFIED Requirements

### Requirement: Text overflow and Text inspector

A text frame whose content exceeds its whole-line box SHALL show the `Overflow` chip (`text-overflow-chip`, constant screen size) in the editor only, hidden while it is edited. A selected text frame SHALL open the Text inspector (Style, Align, Text, Live from photo metadata, Position & size, Arrange, Delete frame), with the meta `Text overflows the frame` while it overflows. The Live block SHALL hold the switch (Make live / Make static), `Anchored to` (only while Live) and the token chips date / title / caption / camera (a chip turns Live on and inserts at the last caret, else appends with `·`, one step); with no image frame on the spread the switch is disabled with a hint. The Text field and canvas editing show the template while Live; the canvas paints the resolved text.

#### Scenario: Title restyle overflows

- **WHEN** a 60 × 14 mm frame holding a caption sentence is set to Title in the inspector
- **THEN** the chip and the meta show in the editor, and Preview shows no chip

#### Scenario: Live caption from a chip

- **WHEN** chip `date` is clicked on a text frame under a photo with a capture date
- **THEN** Live is on, `Anchored to` names that frame, the field shows `{date}` and the canvas the date; another photo dropped on the anchor updates it, and after Make static a swap leaves it unchanged
