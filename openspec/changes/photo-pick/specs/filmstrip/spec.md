## ADDED Requirements

### Requirement: Pick a photo for a frame from the filmstrip

The frame menu's "Replace photo…" (filled photo frame) / "Place photo…" (empty photo frame), enabled when the frame is unlocked and the gallery has a photo, SHALL start pick mode: the filmstrip shows a 2 px `--select` inset ring and copy cursor, the frame a "Replacing" / "Placing" tag, the status a "… · Esc to cancel" hint, and focus moves to the roving thumb. A click or Enter on a thumb SHALL replace / place that photo as one undo step and end the mode. Esc (first), pointerdown outside the filmstrip dock, another active spread, Masters, Preview, or the frame removed / locked SHALL end it with no change.

#### Scenario: Replace from the filmstrip

- **WHEN** the user picks Replace photo… on a filled frame and clicks thumb 3
- **THEN** the frame shows thumb 3's photo, history gains one "Replace photo" step, and pick mode ends
