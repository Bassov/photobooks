## REMOVED Requirements

### Requirement: GPS storage and export policy

The system SHALL store asset `meta.gps` only when the user has opted in to keep location for that library or asset. Site export MUST omit GPS coordinates from any exported package or published payload so that location never leaves the library via site export. This requirement defines policy for writers and exporters; absence of `meta.gps` remains valid.

#### Scenario: Document without GPS remains valid

- **WHEN** an asset `meta` object omits `gps`
- **THEN** parse accepts the document

#### Scenario: Opt-in GPS retained in library document

- **WHEN** an asset includes valid `meta.gps` after user opt-in
- **THEN** parse accepts the document and retains those coordinates in the library document

## ADDED Requirements

### Requirement: GPS library storage and export strip policy

The system SHALL allow asset `meta.gps` in the library book document whenever location is present in extracted metadata (no opt-in gate). Any static export or publish (M5/M7+) MUST strip GPS from published output by default. Absence of `meta.gps` remains valid. Export implementation may land later; this is writer/exporter policy.

#### Scenario: Document without GPS remains valid

- **WHEN** an asset `meta` object omits `gps`
- **THEN** parse accepts the document

#### Scenario: GPS retained in library document without opt-in

- **WHEN** an asset includes valid `meta.gps` from metadata extraction with no consent flag
- **THEN** parse accepts the document and retains those coordinates in the library document

#### Scenario: Export and publish strip GPS by default

- **WHEN** a static export or publish pipeline produces output from a library document that contains `meta.gps`
- **THEN** the published output omits GPS coordinates by default
