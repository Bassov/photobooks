## ADDED Requirements

### Requirement: Folder import and re-scan progress indicator

While a photo-folder first import or post-reload prioritized re-scan is running, the editor SHALL show a simple placeholder progress indicator (reuse existing Status / ProgressBar primitives) with stable test ids so a later visual redesign can restyle without changing observables. Progress MUST update incrementally as batches complete. Styling MAY be minimal; behavior and testids are the contract.

#### Scenario: Import progress advances during folder import

- **WHEN** a folder import is in progress
- **THEN** an element with `data-testid="import-progress"` reports completed/total (or equivalent scanning copy) and updates as batches finish

#### Scenario: Re-scan progress is observable

- **WHEN** a post-reload photo-root re-scan is running
- **THEN** a progress indicator with a stable test id is visible until prioritized work finishes (lazy remainder MAY keep a quieter status or the same indicator)
