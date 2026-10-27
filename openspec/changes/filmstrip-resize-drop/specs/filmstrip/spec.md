## ADDED Requirements

### Requirement: Adjustable filmstrip thumbnail size

The filmstrip dock SHALL let the user change the thumbnail height (64–192 px, default 96) with a top-edge splitter (pointer drag, ↑/↓ keys) or a size slider, and SHALL remember it in the browser. During a drag only CSS variables change; the virtualizer MUST re-lay out once on release, with no gaps in the scrolled strip. Scrolling MUST stay inside the filmstrip scrollport.

#### Scenario: Resize while scrolled mid-gallery

- **WHEN** the user drags the splitter while the strip is scrolled mid-gallery
- **THEN** thumbnails rescale on release and no frame is dropped to LoAF

### Requirement: Desktop folder drop on the filmstrip

A photo folder dropped from the desktop onto the dock SHALL be imported through the same path as "Choose photo folder" (replace confirm when a folder is bound). Loose files MUST NOT be imported and MUST set the status "Drop a folder — Photobooks adds folders, not single photos". Only read-only directory handles are accepted.

#### Scenario: Loose file dropped

- **WHEN** a single photo file is dropped on the dock
- **THEN** nothing is imported and the status explains that folders are required
