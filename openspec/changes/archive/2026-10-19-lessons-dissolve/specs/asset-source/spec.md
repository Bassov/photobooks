## ADDED Requirements

### Requirement: Visibility must not abort off-screen import jobs

Filmstrip or viewport visibility MAY raise decode priority for on-screen assets. Visibility changes MUST NOT abort in-flight import or decode jobs for off-screen assets; aborted work that never retries leaves permanent gray placeholders.

#### Scenario: Scrolling away does not cancel an in-flight import decode

- **WHEN** an import decode job is running for an asset that scrolls out of the filmstrip viewport
- **THEN** that job is not aborted solely due to leaving the viewport
