## ADDED Requirements

### Requirement: Group move of a multi-frame selection

With 2 or more frames selected, a press on the body of any selected frame (filled or empty) with the Select tool SHALL start a pointer move, not a photo drag. Every unlocked selected frame SHALL move by the same delta and locked ones SHALL stay; with all locked nothing moves and the status shows the frame-locked message. The union of the moving frames SHALL snap against anchors that exclude the selection (Alt or snap off skips it; Shift locks the dominant axis) and stay inside the spread. The preview SHALL be direct DOM writes (one translate per moving frame and the group box in the same frame) with no book commit until release, which SHALL commit one `moveFrames` op as one undo step labelled "Move N frames". Esc during the move SHALL put every frame back and keep the selection. Arrows / Shift+arrows with 2 or more selected SHALL nudge every unlocked selected frame by 1 / 10 mm (one undo step per press) without scrolling the pasteboard.

#### Scenario: Group move with a locked frame

- **WHEN** three frames are selected, one locked, and the user drags one of them by 20 mm
- **THEN** the two unlocked frames move by the same delta, the locked one stays, and one Undo restores both

#### Scenario: Esc mid-move and arrows

- **WHEN** the user presses Esc during a group move, or ArrowRight with the set selected
- **THEN** Esc puts every frame back with the set still selected; ArrowRight nudges the unlocked frames 1 mm and the pasteboard does not scroll
