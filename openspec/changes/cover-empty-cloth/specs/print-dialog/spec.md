## MODIFIED Requirements

### Requirement: Cover spine paints the back fill

The editor cover (canvas sheet and mini covers) SHALL paint the spine in the cover's `backFill`, as the cover PDF prints it; a front without a photo (editor cover, mini covers, library card) SHALL paint `backFill` too, with the title in the book's Title font and D38 ink (luminance < 0.23 → #F5F5F5, else #2E2C2D).

#### Scenario: Empty front is cloth

- **WHEN** a book has no front photo
- **THEN** its library card, spread-list Cover row and editor front paint `backFill`, and the editor front shows its drop box only on hover or drag-over
