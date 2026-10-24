## ADDED Requirements

### Requirement: Preview presets are thumb and working only

Derived-cache preset ids for interactive previews SHALL be limited to the filmstrip thumbnail preset and the working pasteboard preview preset (long edge 1280). The system MUST NOT write or require obsolete ladder presets for 640 or 2560.

#### Scenario: Working preview uses the 1280 preset

- **WHEN** a hashed asset's working preview is stored in the derived cache
- **THEN** the preset id identifies the 1280 working size (not 640 or 2560)

#### Scenario: Thumbnail preset remains distinct

- **WHEN** a hashed asset's filmstrip thumbnail is stored
- **THEN** it uses the thumbnail preset id, distinct from the working-preview preset
