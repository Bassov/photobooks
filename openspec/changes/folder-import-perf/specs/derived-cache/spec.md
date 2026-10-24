## MODIFIED Requirements

### Requirement: Encode-after-hash thumb puts are awaited

When the editor publishes a thumb URL and then puts encoded bytes into DerivedCache keyed by `contentHash` (encode-after-hash), that put MUST be registered with the pending-hash tracker (`trackHashJob` / `awaitPendingHashes`) so Save cannot finish before the OPFS write settles. Prioritized reload re-hash MUST continue to use the same tracker for hashes that feed encode-after-hash puts; lazy unused-file hashing MUST NOT block Save via unbounded `awaitPendingHashes` waits for the idle remainder.

#### Scenario: Save waits for encode-after-hash put

- **WHEN** a thumb is published and a DerivedCache put is started for that asset’s `contentHash`
- **THEN** `awaitPendingHashes` does not resolve until that put settles

#### Scenario: Lazy unused hashing does not stall Save

- **WHEN** only idle unused-file hash jobs remain after prioritized used-in-book work
- **THEN** Save is not required to wait for those idle remainder hashes to finish
