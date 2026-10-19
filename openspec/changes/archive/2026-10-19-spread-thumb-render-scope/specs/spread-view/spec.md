## ADDED Requirements

### Requirement: Thumb publish re-renders a spread only for its own photos

A mounted spread MUST re-render for a filmstrip thumbnail publish only when that publish changes the thumb URL of a photo placed on that spread. Publishing a thumb for an asset placed only on another spread MUST NOT increase this spread's render count.

#### Scenario: Sibling idle when the other spread's photo gets a thumb

- **WHEN** two spreads are mounted with different placed photos and no tier or book preview URL for either, and a filmstrip thumb publishes for the photo on the first spread only
- **THEN** the second spread's render count does not increase

#### Scenario: Own spread refreshes when its photo gets a thumb

- **WHEN** a mounted spread has a placed photo with no covering tier or book preview URL, and a filmstrip thumb publishes for that photo
- **THEN** that spread's painted frame shows the new thumb URL
