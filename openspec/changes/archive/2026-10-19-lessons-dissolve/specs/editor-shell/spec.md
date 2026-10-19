## ADDED Requirements

### Requirement: Copy FileList before clearing the file input

When the editor reads `input.files` from a file or folder input and then clears the input with `value = ''`, it MUST copy the `FileList` into a stable array first. `FileList` is live and becomes empty when the value is cleared.

#### Scenario: Clearing the input keeps the import file list

- **WHEN** the user selects files and the handler copies `input.files` then sets `input.value` to empty
- **THEN** the import proceeds with the copied files (not an empty list)

### Requirement: Open existing library loads stored book content

Opening an existing library MUST load a stored book into the editor (preferring a contentful book when several exist). The editor MUST NOT treat “same id as the in-memory `session-book` placeholder already exists” as a no-op adopt that leaves the empty placeholder on screen while disk holds the real document.

#### Scenario: Re-open shows stored book not empty placeholder

- **WHEN** the user opens a library that already has a stored book with content
- **THEN** the editor shows that stored book rather than an empty in-memory placeholder with the same id

### Requirement: Variable-width filmstrip packing uses absolute offsets

Variable-width filmstrip packing MUST place cards using absolute offsets from each card’s end plus gap. It MUST NOT use a fixed max-width stride (`estimatedRowSize` / uniform slot) for variable-aspect galleries.

#### Scenario: Portrait and landscape cards pack without uniform stride holes

- **WHEN** the gallery mixes portrait and landscape assets with known aspects
- **THEN** filmstrip layout positions follow per-card end+gap offsets rather than a single fixed stride

### Requirement: Sliding filmstrip window covers scrollport from aspects

The filmstrip virtual window MUST cover the scrollport width plus overscan using aspect-derived strides. A fixed mounted item count that ignores aspect width MUST NOT leave mid-scroll holes for narrow (portrait) cards.

#### Scenario: Mid-scroll window covers the filmstrip port

- **WHEN** a long mixed-aspect gallery is scrolled to a mid position with more items remaining
- **THEN** the mounted filmstrip window covers the visible scrollport (with overscan) without portrait-sized holes

### Requirement: Empty gallery UI spans the filmstrip scrollport

When the gallery is empty, empty-state copy MUST render at full filmstrip scrollport width. It MUST NOT be laid out inside a 1px / min-width virtualizer window.

#### Scenario: Empty copy is full-width

- **WHEN** the gallery has no assets
- **THEN** the empty-state UI spans the filmstrip scrollport width (not a collapsed virtualizer slot)

### Requirement: Progressive reveal keeps up with filmstrip scroll

While the filmstrip spacer represents the full gallery width and windowing limits DOM, progressive reveal MUST NOT lag behind `scrollLeft` such that mid-scroll shows a dead zone of unrevealed content that should already be in range.

#### Scenario: Mid-scroll reveal has no dead zone

- **WHEN** more gallery items remain and the user scrolls the filmstrip to a mid position during or after progressive import reveal
- **THEN** content that should be in the scrolled window is revealed without a large empty dead zone

### Requirement: Progressive import pacing stays within frame budget

Progressive mid-import filmstrip mounts MUST use pacing that keeps interaction within frame-budget gates (gallery flush / reveal / thumb publish). The system MUST NOT re-freeze the gallery id list solely to pass LoAF.

#### Scenario: Mid-import scroll stays interactive without freezing ids

- **WHEN** a multi-file import is in progress and the user scrolls the filmstrip
- **THEN** newly enqueued ids continue to appear under frame-budget pacing without freezing the gallery id list as the LoAF strategy
