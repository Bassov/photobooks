## ADDED Requirements

### Requirement: PDF export write

The system SHALL write an exported PDF to `<library folder>/exports/<name>`, creating `exports/` when absent and replacing a file of the same name, outside the handle-free `LibraryStorage` API. The name SHALL be `{slug(title)}-{preset id | {w}x{h}cm}.pdf`. A failed write SHALL return `access` (NotAllowedError, SecurityError), `full` (QuotaExceededError) or `other`.

#### Scenario: Same name replaces

- **WHEN** a PDF is exported twice under the same name
- **THEN** `exports/` holds one file with the second bytes
