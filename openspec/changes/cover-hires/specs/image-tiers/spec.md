## ADDED Requirements

### Requirement: Cover photo uses the working preview

The cover front photo on the editor canvas and in Preview SHALL go through the same tier display as filled frames: thumb first, then the decoded 1280 working preview (worker encode, decode-before-swap). The spreads-panel cover row stays thumb-only. The library book card cover SHALL use the cached 1280 working preview for its photo when present, else the thumb.

#### Scenario: Cover sharpens like a page frame

- **WHEN** a photo larger than the thumb edge is dropped on the cover front
- **THEN** the cover image has the same natural width as a page frame's working preview of that photo, and the library tile shows that same 1280 working preview width
