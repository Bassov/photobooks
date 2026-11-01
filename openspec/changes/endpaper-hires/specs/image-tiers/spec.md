## MODIFIED Requirements

### Requirement: Cover photo uses the working preview

The cover front photo and the endpaper photo on the editor canvas, and the cover in Preview, SHALL go through the same tier display as filled frames: thumb first, then the decoded 1280 working preview (worker encode, decode-before-swap). The spreads-panel cover and endpaper rows stay thumb-only. The library book card cover SHALL use the cached 1280 working preview for its photo when present, else the thumb.

#### Scenario: Cover sharpens like a page frame

- **WHEN** a photo larger than the thumb edge is dropped on the cover front
- **THEN** the cover image has the same natural width as a page frame's working preview of that photo, and the library tile shows that same 1280 working preview width

#### Scenario: Endpaper sharpens like a page frame

- **WHEN** an endpaper with a photo is selected on the canvas
- **THEN** both endpaper pages show the 1280 working preview (`data-tier="1280"`) once it is decoded
