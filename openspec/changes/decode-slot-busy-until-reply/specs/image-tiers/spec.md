## MODIFIED Requirements

### Requirement: Cancelling a preview job does not abort import

Cancelling a working-preview job or a queued off-screen thumb job MUST NOT abort an in-flight gallery import batch. Leaving now drops queued thumb jobs; an in-flight thumb320 job finishes and its result is kept. Per-asset abort MUST allow re-enqueue when the asset re-enters the now set without a hot thumb.

#### Scenario: Import still completes

- **WHEN** a working-preview request is cancelled while an import of files is still running
- **THEN** that import still completes

#### Scenario: Scroll-out cancel can retry

- **WHEN** a queued thumb job is aborted because the asset left the now set and later re-enters it without a hot thumb
- **THEN** a new now-priority encode is queued

#### Scenario: In-flight thumb survives scroll-out

- **WHEN** an asset leaves the now set while its thumb320 decode is in flight
- **THEN** the decode result is kept rather than discarded
