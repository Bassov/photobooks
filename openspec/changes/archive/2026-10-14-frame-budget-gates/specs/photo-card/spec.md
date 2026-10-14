## MODIFIED Requirements

### Requirement: Main-thread budget on import

Image decode and preview preparation for import MUST NOT run as blocking work on the main thread. An automated import scenario for a ~24MP JPEG MUST record zero LoAF entries during the scenario window (under the project's calibrated CDP CPU throttling when run in CI).

#### Scenario: Large JPEG import stays within LoAF budget

- **WHEN** a ~24MP JPEG is imported through the photo-card flow in the LoAF scenario test
- **THEN** no LoAF entry is recorded during the scenario window
