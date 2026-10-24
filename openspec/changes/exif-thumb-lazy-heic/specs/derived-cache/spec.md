## ADDED Requirements

### Requirement: Temporary EXIF thumbs are not durable presets

Embedded JPEG EXIF thumbnails used as first-import filmstrip placeholders MUST remain session-only object URLs (or equivalent hot cache). The system MUST NOT put those bytes into DerivedCache under the thumbnail or working-preview preset ids. Durable thumbs remain the encoded thumb320 (and working preview) keyed by identity digest.

#### Scenario: EXIF thumb does not write OPFS thumb preset

- **WHEN** an IFD1 embedded thumbnail is shown as a temporary filmstrip placeholder
- **THEN** DerivedCache is not written under the thumbnail preset for those embedded bytes alone
