## RENAMED Requirements

- FROM: `### Requirement: Two preview sizes only`
- TO: `### Requirement: Thumbnail plus a working ladder by device pixels`

## MODIFIED Requirements

### Requirement: Thumbnail plus a working ladder by device pixels

The system SHALL use a filmstrip thumbnail (long edge 320) and a working pasteboard ladder of 1280 and 2560 long edge. A filled frame SHALL request the smallest working step at least its on-screen long edge × device pixel ratio (camera zoom and crop included), and 2560 above that; it MUST stay on 1280 when the source long edge is known and at most 1280, and a step MUST NOT be encoded larger than its source. Jobs above 1280 MUST rank below 1280 jobs, and a released frame aborts its in-flight job. An asset drag SHALL start the 1280 step on dragstart and the hovered frame's step before the drop. Original image bytes MUST NOT be placed in the document DOM. The 640 step MUST NOT be encoded or selected.

#### Scenario: Pasteboard always requests the working preview

- **WHEN** a filled frame needs a zoom/preview source
- **THEN** the chosen tier is a working step (1280 or 2560), never the thumbnail size

#### Scenario: Normal screens stay on the working preview

- **WHEN** a frame is 900 CSS px on its long edge at device pixel ratio 1, or 300 CSS px at ratio 2
- **THEN** the chosen working tier is 1280

#### Scenario: HiDPI frames use the 2560 step

- **WHEN** a frame is 900 CSS px on its long edge at device pixel ratio 2 and the source is larger than 1280 px or of unknown size
- **THEN** the chosen working tier is 2560, and a 2000 px source yields a preview no larger than 2000 px

#### Scenario: Filmstrip uses the thumbnail size

- **WHEN** a gallery card needs a thumbnail
- **THEN** the encode long-edge cap is 320

### Requirement: Progressive thumb then working preview

While the covering working step is not yet decoded for display, a filled frame MUST show the best available lower source already on hand (a lower working step, else the filmstrip thumb) and MUST NOT render as an empty placeholder solely because the covering step is still loading. After a step finishes decode, the frame MUST switch to it without an empty flash; a drop onto a frame MUST NOT show an image with zero natural width between tiers.

#### Scenario: Thumb shows before working decode

- **WHEN** the working preview URL is not ready and a filmstrip thumb URL exists
- **THEN** the frame shows the thumb instead of a blank placeholder

#### Scenario: Working preview replaces the provisional source

- **WHEN** the covering step finishes decode while a thumb or a lower step is shown
- **THEN** the frame switches to it without an empty flash
