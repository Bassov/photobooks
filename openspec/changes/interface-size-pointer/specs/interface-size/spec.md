## ADDED Requirements

### Requirement: Pointer, bitmap and site preview under interface scale

At interface scale s, every editor pointer gesture SHALL move what it drags by the pointer's screen movement (±1 px): frame drag, resize handle, crop pan, marquee, guide drag, panel splitter, filmstrip separator, spread-list reorder, filmstrip drag to a drop target and the wheel-zoom anchor. Editor bitmaps SHALL use device px per app px = `devicePixelRatio × s` (rulers canvas backing, image tier choice). The site preview room SHALL render at visitor size (net zoom 1) while its Preview bar scales with the app. At s = 1 nothing changes.

#### Scenario: Panel splitter at 150 %

- **WHEN** the window is 3840×2160 with choice `"150"` and the user drags the left panel splitter 60 screen px to the right
- **THEN** the panel's right edge moves 60 screen px (±1)

#### Scenario: Rulers and site preview at 150 %

- **WHEN** the window is 3840×2160 with DPR 1 and choice `"150"`
- **THEN** the top ruler canvas is 1.5× its CSS width in device px, and in Preview the bar is 72 px tall while the site room spans the window at visitor size
