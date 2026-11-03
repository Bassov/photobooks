## ADDED Requirements

### Requirement: Marquee selection

With the Select tool, a press on the pasteboard (gaps included, scrollbars excluded) or on paper not covered by a frame SHALL start a marquee once the pointer travels 3 px; below that it SHALL stay the pasteboard click. The marquee SHALL target the spread under the press (on the pasteboard, the spread that click activates) and hit every own frame of that spread, locked included, whose painted axis-aligned box (rotation included) it touches; parent and other-spread frames SHALL NOT be hit. Hit frames SHALL show the selected outline live, from a hit index built at press (no per-move DOM scan). Release SHALL select the hits, unioned with the previous selection on that spread when Shift was held at the press; Esc SHALL cancel it and restore the previous selection. The Hand tool and Space-pan SHALL pan instead. The box SHALL be screen px: `--select` 10% fill, 1 px solid `--color-mark` outline, square corners, above the group box, clipped to the scrollport.

#### Scenario: Marquee from the pasteboard

- **WHEN** the user drags from the pasteboard beside a spread across two of its frames, then Shift-drags over a third, then starts another drag and presses Esc
- **THEN** the first drag selects 2 frames, the Shift drag 3, and after Esc the 3 stay selected
