## ADDED Requirements

### Requirement: Preview preserves source alpha

Orientation-corrected preview thumbnails and zoom tiers for PNG and WebP sources MUST preserve transparent pixels (alpha channel). JPEG sources MUST continue to produce JPEG previews.

#### Scenario: Transparent PNG preview is not filled black

- **WHEN** the user imports a PNG with transparent corners and places it in a frame
- **THEN** the filmstrip thumbnail and the placed frame image show transparent corners (page/filmstrip background visible), not opaque black

#### Scenario: JPEG preview format unchanged

- **WHEN** the user imports a JPEG
- **THEN** the generated preview is labeled and encoded as `image/jpeg`
