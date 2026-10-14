# Spec Delta

## MODIFIED Requirements

### Requirement: Filmstrip asset representation

After a successful import of an asset, the system SHALL represent it in the filmstrip with an orientation-corrected preview thumbnail once ready. Corrected pixel dimensions and aspect metadata MUST be available for that asset for later layout use. The visible filmstrip item silhouette MUST reflect that aspect (clamped) so orientation and non-standard ratios are distinguishable without opening the asset.

#### Scenario: Filmstrip shows orientation-corrected preview

- **WHEN** a supported image with non-default EXIF orientation imports successfully
- **THEN** the filmstrip thumbnail is displayed with that orientation applied so the subject appears upright

#### Scenario: Aspect metadata available after import

- **WHEN** a supported image imports successfully
- **THEN** corrected width and height (or equivalent aspect) for that asset are retained for layout consumers

#### Scenario: Card shows metadata

- **WHEN** a supported image imports successfully
- **THEN** corrected dimensions and aspect are retained for that asset (legacy card UI is not required)

#### Scenario: Preview respects EXIF orientation

- **WHEN** the image has a non-default EXIF orientation
- **THEN** the filmstrip preview is displayed with that orientation applied so the subject appears upright

#### Scenario: Filmstrip silhouette reflects aspect

- **WHEN** a supported image imports successfully and corrected aspect is known
- **THEN** the filmstrip item’s visible width-to-height silhouette matches that aspect within the filmstrip’s clamp limits
