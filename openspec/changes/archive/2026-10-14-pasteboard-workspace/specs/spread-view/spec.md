# Spec Delta

## REMOVED Requirements

### Requirement: Default workspace stays a placeholder

**Reason**: The workspace now shows the session book's pasteboard on every visit.
**Migration**: A normal visit paints the session book's single spread. The fixture book still loads only with `fixture=painter`.

### Requirement: Fixture workspace scrollport

**Reason**: The vertical scrollport is the pasteboard for every book, not only the painter fixture.
**Migration**: Use the pasteboard scrollport requirement. Page-level scroll stays forbidden.

## MODIFIED Requirements

### Requirement: Painter fixture on query

When the URL query `fixture=painter` is present, the system SHALL load an in-memory book of 40 spreads on the 4-grid template with four frames each, leave the first frame of the first spread empty, supply synthetic previews for the other frames, and represent that book on the pasteboard without mounting every spread.

#### Scenario: Fixture paints forty spreads

- **WHEN** the app opens with `fixture=painter`
- **THEN** the first spread's first frame is an empty placeholder, the pasteboard scroll extent represents 40 spreads, and fewer than 40 spreads are mounted

## ADDED Requirements

### Requirement: Pasteboard stacks spreads

The workspace SHALL stack every spread of the current book vertically in one pasteboard, centered horizontally with a gap between spreads.

#### Scenario: Session book shows its spread

- **WHEN** the user opens the app without `fixture=painter`
- **THEN** the workspace shows that book's one spread and does not show a placeholder sentence

### Requirement: Off-screen spreads stay unmounted

Spreads outside the near-viewport window MUST NOT be mounted. The scroll extent MUST still represent the full stack, and the mounted window MUST cover the visible scrollport while more spreads remain beyond it.

#### Scenario: Mid-scroll window covers the port

- **WHEN** the user scrolls the fixture pasteboard to the middle and more spreads remain below
- **THEN** mounted spreads cover the visible scrollport and the mounted count stays below the full stack

### Requirement: Active spread follows scroll

The pasteboard SHALL mark exactly one spread as active: the spread that occupies the scrollport. When scrolling brings a different spread into the port, that spread MUST become the marked one.

#### Scenario: Active spread changes with scroll

- **WHEN** the fixture pasteboard is scrolled so a later spread occupies the scrollport
- **THEN** that later spread is marked active and the first spread is not

### Requirement: Mounted spread skips off-screen paint

Each mounted spread MUST contain layout, paint, and style, use content-visibility that skips off-screen painting, and declare an intrinsic block size equal to its slot in the stack.

#### Scenario: Mounted spread declares containment

- **WHEN** a spread is mounted on the pasteboard
- **THEN** that spread contains layout, paint, and style, skips off-screen painting via content-visibility, and has an intrinsic block size

### Requirement: Pasteboard scrollport

The pasteboard SHALL be the vertical scrollport for the spread stack. The document MUST NOT gain page-level horizontal or vertical scroll.

#### Scenario: Scroll stays inside the pasteboard

- **WHEN** the fixture stack is taller than the workspace
- **THEN** the pasteboard scrolls vertically and the document element does not scroll
