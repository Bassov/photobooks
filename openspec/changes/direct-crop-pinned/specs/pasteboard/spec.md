## ADDED Requirements

### Requirement: Pinned crop and rotate chip

Crop mode (double-click, Crop button) SHALL pin the photo layer: ghost, grabber and 4 photo handles stay shown with the "Crop · N%" tag and the 2 px `--crop` outline, frame handles hidden; Tab cycles the photo handles, arrows nudge the photo 1 screen px (Shift 10), the wheel zooms the photo, Esc or a click outside exits; one history step per gesture, key press or wheel burst. A direct photo frame SHALL show the rotate knob, and while rotating a screen-px chip 10 px right of it with the angle; Shift rotates in 15° steps, else the angle snaps to 0 / 90 / 180 / 270 within ±2°. A frame side < 40 screen px hides that side's mid handles; a side < 64 px hides the grabber.

#### Scenario: Pinned nudge and Tab

- **WHEN** the user double-clicks a photo frame, presses Tab twice and ArrowRight
- **THEN** the second photo handle has focus, the photo moved 1 px right and one Undo moves it back
