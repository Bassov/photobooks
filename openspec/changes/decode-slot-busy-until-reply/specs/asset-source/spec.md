## MODIFIED Requirements

### Requirement: Visibility must not abort off-screen import jobs

Filmstrip or viewport visibility MUST place on-screen and book-used assets on the **now** decode lane and MAY enqueue other gallery assets on the **background** lane only during idle time. When an asset leaves the now set (and is not book-used), the system MUST drop that asset's queued thumb/working decode jobs and abort its in-flight working-preview (1280) job. An in-flight thumb320 job MUST run to completion and its result MUST be published and stored. The system MUST re-enqueue at now when the asset re-enters without a hot thumb. Per-asset abort MUST NOT cancel the gallery import batch or list-first placeholder progress; aborted work that never retries MUST NOT leave permanent gray placeholders.

#### Scenario: Scrolling away drops queued decode

- **WHEN** a thumb decode job is queued for an asset that leaves the filmstrip/spread now set and is not book-used
- **THEN** that job is aborted solely due to leaving the now set

#### Scenario: Scrolling away keeps an in-flight thumb

- **WHEN** a thumb320 decode is already running for an asset that leaves the now set
- **THEN** the decode finishes and the import publishes and stores its thumb

#### Scenario: Re-entry retries decode

- **WHEN** a cancelled asset re-enters the now set without a hot thumb
- **THEN** decode is queued again on the now lane

#### Scenario: Import batch continues after per-asset abort

- **WHEN** off-now thumb jobs are aborted during an import
- **THEN** list-first gallery placeholders and the import batch continue for remaining files
