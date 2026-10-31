## MODIFIED Requirements

### Requirement: Import decode reuses one body read for library seed

When a full original body is read for import decode/encode, the system MUST reuse those bytes for library `seedAndHashEntry` (no second full-file `arrayBuffer` on the happy path). The seed applies to memory-backed roots only (a registered memory source, or none yet): the decode worker returns the body (transferred, not cloned) only for those. FSA-backed roots skip the seed and the body copy; files re-resolve from the folder handle and only identity-keyed DerivedCache puts run. Deferred lazy assets MAY skip body read until decode runs.

#### Scenario: Seed uses preloaded bytes

- **WHEN** import decode already has the file body for an asset whose root is memory-backed
- **THEN** seed uses those bytes without a second full-file body read

#### Scenario: FSA root skips the seed

- **WHEN** an asset whose root has a registered FSA source finishes import decode
- **THEN** the worker result carries no source body and no memory seed runs
