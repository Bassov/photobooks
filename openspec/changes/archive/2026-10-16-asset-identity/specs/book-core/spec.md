# Spec Delta

## MODIFIED Requirements

### Requirement: Asset record fields

Each asset map value SHALL be a record that MAY include `sourceRootId` (non-empty string), `relativePath` (non-empty string), `byteSize` (non-negative integer), `mtimeMs` (finite number), and `contentHash` (64-character lowercase hexadecimal SHA-256 digest). All five fields are optional. When present, values MUST satisfy those constraints. The record MUST NOT include File, Blob, or filesystem handles.

#### Scenario: Full asset record parses

- **WHEN** an asset value includes valid `sourceRootId`, `relativePath`, `byteSize`, `mtimeMs`, and a 64-character lowercase hex `contentHash`
- **THEN** parse accepts the document and retains those fields

#### Scenario: Empty asset record parses

- **WHEN** an asset value is `{}`
- **THEN** parse accepts the document

#### Scenario: Negative byte size rejected

- **WHEN** an asset value has `byteSize` less than 0
- **THEN** parse fails

#### Scenario: Empty string identity field rejected

- **WHEN** an asset value has `sourceRootId`, `relativePath`, or `contentHash` equal to `""`
- **THEN** parse fails

#### Scenario: Non-SHA-256 contentHash rejected

- **WHEN** an asset value has `contentHash` that is not a 64-character lowercase hexadecimal string
- **THEN** parse fails
