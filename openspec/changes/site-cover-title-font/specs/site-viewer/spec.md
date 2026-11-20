## ADDED Requirements

### Requirement: Cover title face

The site cover title (CSS and GL, home, room and Preview) SHALL use the book's Title font face as the editor cover does (serif faces: Lora, upright or italic, weight 400); a `sans` Title font, or an entry without one, SHALL keep the site sans. Spine and shelf titles keep the site sans.

#### Scenario: Serif italic title

- **WHEN** a book with `titleFont: serif-italic` is shown in Preview or on the exported site
- **THEN** its cover title paints in Lora italic in the unchanged ink
