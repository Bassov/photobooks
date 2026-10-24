## MODIFIED Requirements

### Requirement: Visibility must not abort off-screen import jobs

Filmstrip or viewport visibility MUST place on-screen and book-used assets on the **now** decode lane and MAY enqueue other gallery assets on the **background** lane only during idle time. When an asset leaves the now set (and is not book-used), the system MUST abort that asset’s queued or in-flight thumb/working decode job and MUST re-enqueue at now when it re-enters without a hot thumb. Per-asset abort MUST NOT cancel the gallery import batch or list-first placeholder progress; aborted work that never retries MUST NOT leave permanent gray placeholders.

#### Scenario: Scrolling away cancels off-now decode

- **WHEN** a thumb decode job is running or queued for an asset that leaves the filmstrip/spread now set and is not book-used
- **THEN** that job is aborted solely due to leaving the now set

#### Scenario: Re-entry retries decode

- **WHEN** a cancelled asset re-enters the now set without a hot thumb
- **THEN** decode is queued again on the now lane

#### Scenario: Import batch continues after per-asset abort

- **WHEN** off-now thumb jobs are aborted during an import
- **THEN** list-first gallery placeholders and the import batch continue for remaining files
